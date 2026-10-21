package com.gyaansetu.servlet;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.gyaansetu.ai.ClaudeService;
import com.gyaansetu.dao.PlannerDao;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker.Scored;
import com.gyaansetu.web.ApiException;
import com.gyaansetu.web.ApiServlet;
import com.gyaansetu.web.RankContext;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * GET    /api/goals            list
 * POST   /api/goals            {text, day}
 * POST   /api/goals/plan       replaces open goals with an AI (or offline) 5-day plan
 * PUT    /api/goals/{id}       {done}
 * DELETE /api/goals/{id}
 */
@WebServlet("/api/goals/*")
public class GoalServlet extends ApiServlet {
    static final List<String> DAYS = List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");

    static Map<String, Object> view(PlannerDao.Goal g) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", g.id());
        m.put("text", g.text());
        m.put("day", g.day());
        m.put("done", g.done());
        return m;
    }

    private static List<Map<String, Object>> all(Connection c, long uid) throws Exception {
        List<Map<String, Object>> out = new ArrayList<>();
        for (PlannerDao.Goal g : PlannerDao.goals(c, uid)) out.add(view(g));
        return out;
    }

    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        long uid = requireUser(req);
        try (Connection c = db()) { json(resp, Map.of("goals", all(c, uid))); }
    }

    @Override
    protected void post(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        long uid = requireUser(req);
        if (p.length == 1 && p[0].equals("plan")) { plan(req, resp, uid); return; }
        if (p.length != 0) throw ApiException.notFound("Not found.");
        JsonObject b = body(req);
        String text = str(b, "text", 200), day = str(b, "day", 3);
        if (text.length() < 3) throw ApiException.badRequest("Write a goal of at least a few characters.");
        if (!DAYS.contains(day)) throw ApiException.badRequest("Choose a day from Mon to Sun.");
        try (Connection c = db()) {
            PlannerDao.addGoal(c, uid, text, day, false);
            json(resp, 201, Map.of("goals", all(c, uid), "message", "Goal added."));
        }
    }

    @Override
    protected void put(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length != 1) throw ApiException.notFound("Not found.");
        long uid = requireUser(req);
        JsonObject b = body(req);
        if (!b.has("done")) throw ApiException.badRequest("Send {\"done\": true|false}.");
        boolean done = b.get("done").getAsBoolean();
        try (Connection c = db()) {
            if (!PlannerDao.setDone(c, uid, parseId(p[0]), done)) throw ApiException.notFound("Goal not found.");
            if (done) UserDao.addPoints(c, uid, 1);
            json(resp, Map.of("goals", all(c, uid), "message", done ? "Goal done. Nice work!" : "Goal reopened."));
        }
    }

    @Override
    protected void delete(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length != 1) throw ApiException.notFound("Not found.");
        long uid = requireUser(req);
        try (Connection c = db()) {
            if (!PlannerDao.deleteGoal(c, uid, parseId(p[0]))) throw ApiException.notFound("Goal not found.");
            json(resp, Map.of("goals", all(c, uid), "message", "Goal removed."));
        }
    }

    private void plan(HttpServletRequest req, HttpServletResponse resp, long uid) throws Exception {
        try (Connection c = db()) {
            RankContext ctx = new RankContext(c, uid);
            Set<String> interests = new LinkedHashSet<>();
            for (PlannerDao.Search s : PlannerDao.searches(c, uid, 5)) interests.add(s.query());
            ctx.profile.subjects.keySet().forEach(k -> interests.add(Catalog.subjectName(k)));
            List<Scored> cands = interests.isEmpty() ? ctx.rank(null).rows() : ctx.rank(String.join(" ", interests)).rows();
            if (cands.isEmpty()) cands = ctx.rank(null).rows();
            cands = cands.subList(0, Math.min(8, cands.size()));

            List<String[]> goals = new ArrayList<>();
            String mode = "offline", note = "";
            if (ClaudeService.enabled()) {
                StringBuilder list = new StringBuilder();
                for (Scored x : cands) list.append("\"").append(x.r.title).append("\" (").append(Catalog.typeLabel(x.r.type)).append(", ").append(x.r.level).append("); ");
                try {
                    JsonElement out = ClaudeService.askJson("You are GyaanSetu's study planner. Make a realistic 5-day study plan (Mon-Fri, about 45 minutes a day) "
                            + "for a student interested in: " + (interests.isEmpty() ? "computer science and maths" : String.join(", ", interests)) + ".\n"
                            + "Use these resources where they fit, naming them by title: " + list + "\n"
                            + "Reply with a JSON array of 5 objects: [{\"day\": \"Mon\", \"text\": \"one concrete task under 90 characters\"}].");
                    if (out.isJsonArray()) {
                        for (JsonElement e : out.getAsJsonArray()) {
                            if (!e.isJsonObject()) continue;
                            JsonObject o = e.getAsJsonObject();
                            String text = o.has("text") ? o.get("text").getAsString().trim() : "";
                            String day = o.has("day") ? o.get("day").getAsString().trim() : "Mon";
                            if (text.isEmpty()) continue;
                            goals.add(new String[]{DAYS.contains(day) ? day : "Mon", text.length() > 200 ? text.substring(0, 200) : text});
                            if (goals.size() == 7) break;
                        }
                    }
                    if (!goals.isEmpty()) { mode = "claude"; note = "Plan written by Claude."; }
                } catch (ClaudeService.AiUnavailable e) {
                    note = e.getMessage() + " Showing an offline plan.";
                }
            }
            if (goals.isEmpty()) {
                for (int i = 0; i < Math.min(5, cands.size()); i++) {
                    Scored x = cands.get(i);
                    String verb = switch (x.r.type) { case "video" -> "Watch"; case "pdf" -> "Read"; case "tutorial" -> "Work through"; case "image" -> "Study"; default -> "Read"; };
                    goals.add(new String[]{DAYS.get(i), verb + ": " + x.r.title});
                }
                if (note.isEmpty()) note = "Planned from your top-ranked resources (offline mode).";
            }
            c.setAutoCommit(false);
            try {
                PlannerDao.deleteOpenGoals(c, uid);
                for (String[] g : goals) PlannerDao.addGoal(c, uid, g[1], g[0], false);
                c.commit();
            } catch (Exception e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
            json(resp, Map.of("goals", all(c, uid), "mode", mode, "message", note));
        }
    }
}
