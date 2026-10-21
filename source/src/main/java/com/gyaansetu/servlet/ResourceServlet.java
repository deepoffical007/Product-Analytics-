package com.gyaansetu.servlet;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.gyaansetu.dao.EngagementDao;
import com.gyaansetu.dao.PlannerDao;
import com.gyaansetu.dao.ResourceDao;
import com.gyaansetu.dao.ReviewDao;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker;
import com.gyaansetu.engine.Ranker.Scored;
import com.gyaansetu.engine.Sentiment;
import com.gyaansetu.web.ApiException;
import com.gyaansetu.web.ApiServlet;
import com.gyaansetu.web.RankContext;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET  /api/resources?q=&types=&subject=&level=&minRating=&minViews=&sort=&w=&limit=&log=1   ranked search
 * GET  /api/resources/recommended                                                            personalised picks
 * GET  /api/resources/{id}?q=                                                                details (counts a view)
 * POST /api/resources/{id}/like | save | complete | rate {stars} | feedback {value} | reviews {body}
 */
@WebServlet("/api/resources/*")
public class ResourceServlet extends ApiServlet {

    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length == 0) search(req, resp);
        else if (p.length == 1 && p[0].equals("recommended")) recommended(req, resp);
        else if (p.length == 1) detail(req, resp, p[0]);
        else throw ApiException.notFound("Not found.");
    }

    private void search(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String q = trim(req.getParameter("q"), 120);
        Ranker.Filters f = new Ranker.Filters();
        String types = req.getParameter("types");
        if (types != null && !types.isBlank()) {
            for (String t : types.split(",")) if (Catalog.TYPES.containsKey(t.trim())) f.types.add(t.trim());
        }
        String subject = req.getParameter("subject");
        if (subject != null && Catalog.SUBJECTS.containsKey(subject)) f.subject = subject;
        String level = req.getParameter("level");
        if (level != null && Catalog.LEVELS.contains(level)) f.level = level;
        f.minRating = clamp(parseDouble(req.getParameter("minRating")), 0, 5);
        f.minViews = (long) Math.max(0, parseDouble(req.getParameter("minViews")));
        String sort = req.getParameter("sort");
        if (sort != null && List.of("best", "rating", "likes", "views", "newest").contains(sort)) f.sort = sort;
        int limit = (int) clamp(parseDouble(req.getParameter("limit")), 0, 100);

        try (Connection c = db()) {
            Long uid = userId(req);
            if (uid != null && "1".equals(req.getParameter("log")) && !q.isBlank()) PlannerDao.addSearch(c, uid, q);
            RankContext ctx = new RankContext(c, uid);
            Ranker.Result res = ctx.rank(q, f, RankContext.parseWeights(req.getParameter("w")));
            Map<String, Integer> typeCounts = new LinkedHashMap<>(), subjectCounts = new LinkedHashMap<>();
            for (Scored x : res.matched()) {
                typeCounts.merge(x.r.type, 1, Integer::sum);
                subjectCounts.merge(x.r.subject, 1, Integer::sum);
            }
            List<Scored> rows = limit > 0 ? res.rows().subList(0, Math.min(limit, res.rows().size())) : res.rows();
            List<Map<String, Object>> items = new ArrayList<>();
            for (Scored x : rows) items.add(ctx.view(x));
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("query", q);
            out.put("expanded", res.query() == null ? List.of() : res.query().expanded());
            out.put("words", res.query() == null ? List.of() : res.query().words());
            out.put("total", res.rows().size());
            out.put("matched", res.matched().size());
            out.put("typeCounts", typeCounts);
            out.put("subjectCounts", subjectCounts);
            out.put("personalised", ctx.profile.total > 0);
            out.put("items", items);
            json(resp, out);
        }
    }

    private void recommended(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        int limit = (int) clamp(parseDouble(req.getParameter("limit")), 1, 12);
        if (req.getParameter("limit") == null) limit = 4;
        try (Connection c = db()) {
            RankContext ctx = new RankContext(c, userId(req));
            List<Map<String, Object>> items = new ArrayList<>();
            for (Scored x : ctx.recommendations(limit)) items.add(ctx.view(x));
            json(resp, Map.of("personalised", ctx.profile.total > 0, "items", items));
        }
    }

    private void detail(HttpServletRequest req, HttpServletResponse resp, String id) throws Exception {
        String q = trim(req.getParameter("q"), 120);
        try (Connection c = db()) {
            if (!ResourceDao.exists(c, id)) throw ApiException.notFound("This resource does not exist.");
            if (!"0".equals(req.getParameter("view"))) ResourceDao.addViews(c, id, 1);
            Long uid = userId(req);
            RankContext ctx = new RankContext(c, uid);
            Scored x = ctx.score(id, q);
            Map<String, Object> item = ctx.view(x);

            List<Map<String, Object>> reviews = new ArrayList<>();
            for (ReviewDao.Review r : ReviewDao.list(c, id, uid)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", r.id());
                m.put("author", r.author());
                m.put("body", r.body());
                m.put("stars", r.stars());
                m.put("sentiment", Math.round(r.sentiment() * 100) / 100.0);
                m.put("label", Sentiment.label(r.sentiment()));
                m.put("upvotes", r.upvotes());
                m.put("voted", r.voted());
                m.put("mine", r.mine());
                m.put("createdAt", r.createdAt().getTime());
                reviews.add(m);
            }

            List<Map<String, Object>> related = new ArrayList<>();
            java.util.Set<String> seen = new java.util.HashSet<>(List.of(id));
            for (Scored y : ctx.rank(String.join(" ", x.r.tags.subList(0, Math.min(3, x.r.tags.size())))).rows()) {
                if (related.size() == 4) break;
                if (seen.add(y.r.id)) related.add(ctx.view(y));
            }
            for (Scored y : ctx.rank(null).rows()) {   // top up with the best resources in the same subject
                if (related.size() == 4) break;
                if (y.r.subject.equals(x.r.subject) && seen.add(y.r.id)) related.add(ctx.view(y));
            }

            boolean hasQ = q != null && !q.isBlank();
            List<Map<String, Object>> checks = List.of(
                    check(hasQ ? x.rel >= 0.5 : true, hasQ ? "Relevant to your search" : "Matches " + Catalog.subjectName(x.r.subject)),
                    check(x.eng >= 0.45, "High user engagement"),
                    check(x.positive >= 0.6, "Positive feedback"),
                    check(x.bayes >= 4.4, "Highly rated"),
                    check(Catalog.VERIFIED.contains(x.r.source), "Verified source"));

            double avg = x.s.avgRating();
            double[] w = new double[5];
            double sum = 0;
            for (int k = 5; k >= 1; k--) { w[5 - k] = Math.exp(-Math.pow(k - avg, 2) / 0.9); sum += w[5 - k]; }
            List<Integer> distribution = new ArrayList<>();
            for (double v : w) distribution.add((int) Math.round(v / sum * 100));

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("item", item);
            out.put("reviews", reviews);
            out.put("related", related);
            out.put("checks", checks);
            out.put("distribution", distribution);
            out.put("weights", Ranker.DEFAULT_WEIGHTS);
            json(resp, out);
        }
    }

    private static Map<String, Object> check(boolean ok, String label) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ok", ok);
        m.put("label", label);
        return m;
    }

    @Override
    protected void post(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length != 2) throw ApiException.notFound("Not found.");
        String id = p[0], action = p[1];
        long uid = requireUser(req);
        JsonObject b = action.equals("like") || action.equals("save") || action.equals("complete") ? new JsonObject() : body(req);
        String message;
        try (Connection c = db()) {
            if (!ResourceDao.exists(c, id)) throw ApiException.notFound("This resource does not exist.");
            c.setAutoCommit(false);
            try {
                message = switch (action) {
                    case "like" -> {
                        boolean on = EngagementDao.toggle(c, "likes", uid, id);
                        ResourceDao.addLikes(c, id, on ? 1 : -1);
                        yield on ? "Liked. Ranking updated." : "Like removed.";
                    }
                    case "save" -> EngagementDao.toggle(c, "saved", uid, id) ? "Saved to your library." : "Removed from your library.";
                    case "complete" -> {
                        boolean on = EngagementDao.toggle(c, "completed", uid, id);
                        if (on) UserDao.addPoints(c, uid, 3);
                        yield on ? "Marked complete. +3 points" : "Marked as not complete.";
                    }
                    case "rate" -> rate(c, uid, id, b);
                    case "feedback" -> feedback(c, uid, id, b);
                    case "reviews" -> review(c, uid, id, b);
                    default -> throw ApiException.notFound("Not found.");
                };
                c.commit();
            } catch (Exception e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
            RankContext ctx = new RankContext(c, uid);
            json(resp, Map.of("message", message, "item", ctx.view(ctx.score(id, null))));
        }
    }

    private static String rate(Connection c, long uid, String id, JsonObject b) throws Exception {
        JsonElement e = b.get("stars");
        int stars = e == null || e.isJsonNull() ? 0 : e.getAsInt();
        if (stars < 0 || stars > 5) throw ApiException.badRequest("Stars must be between 1 and 5.");
        Integer old = EngagementDao.rating(c, uid, id);
        if (stars == 0) {
            if (old != null) ResourceDao.adjustRating(c, id, -old, -1);
            EngagementDao.setRating(c, uid, id, null);
            return "Rating removed.";
        }
        if (old == null) { ResourceDao.adjustRating(c, id, stars, 1); UserDao.addPoints(c, uid, 2); }
        else ResourceDao.adjustRating(c, id, stars - old, 0);
        EngagementDao.setRating(c, uid, id, stars);
        return "Rated " + stars + " ★. Ranking updated.";
    }

    private static String feedback(Connection c, long uid, String id, JsonObject b) throws Exception {
        String v = str(b, "value", 5);
        if (!v.isEmpty() && !v.equals("yes") && !v.equals("no")) throw ApiException.badRequest("Feedback must be yes or no.");
        Boolean old = EngagementDao.feedback(c, uid, id);
        if (old != null) ResourceDao.adjustHelpful(c, id, old ? -1 : 0, old ? 0 : -1);
        Boolean now = v.isEmpty() ? null : v.equals("yes");
        if (now != null) ResourceDao.adjustHelpful(c, id, now ? 1 : 0, now ? 0 : 1);
        EngagementDao.setFeedback(c, uid, id, now);
        return now == null ? "Feedback removed." : "Thanks for the feedback.";
    }

    private static String review(Connection c, long uid, String id, JsonObject b) throws Exception {
        String text = str(b, "body", 1500);
        if (text.length() < 3) throw ApiException.badRequest("Write a few words before posting.");
        UserDao.User u = UserDao.find(c, uid);
        // One review per learner per resource: posting again replaces the earlier review (no extra points).
        boolean replaced = ReviewDao.deleteByUser(c, id, uid);
        ReviewDao.add(c, id, uid, u == null ? "Learner" : u.name(), text, EngagementDao.rating(c, uid, id),
                Sentiment.score(text), 0, null);
        if (replaced) return "Review updated. Ranking updated.";
        UserDao.addPoints(c, uid, 5);
        return "Review posted. +5 points. Ranking updated.";
    }

    static String trim(String s, int max) {
        if (s == null) return "";
        s = s.trim();
        return s.length() > max ? s.substring(0, max) : s;
    }

    static double parseDouble(String s) {
        if (s == null || s.isBlank()) return 0;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return 0; }
    }

    static double clamp(double v, double lo, double hi) { return Math.max(lo, Math.min(hi, v)); }
}
