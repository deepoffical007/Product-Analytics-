package com.gyaansetu.servlet;

import com.gyaansetu.dao.EngagementDao;
import com.gyaansetu.dao.PlannerDao;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker.Scored;
import com.gyaansetu.web.ApiException;
import com.gyaansetu.web.ApiServlet;
import com.gyaansetu.web.RankContext;
import com.gyaansetu.web.Views;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * GET    /api/dashboard   stats, recent searches, recommendations, library, goals and leaderboard
 * DELETE /api/dashboard/searches   clears search history
 */
@WebServlet("/api/dashboard/*")
public class DashboardServlet extends ApiServlet {
    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        if (path(req).length != 0) throw ApiException.notFound("Not found.");
        long uid = requireUser(req);
        try (Connection c = db()) {
            UserDao.User me = UserDao.find(c, uid);
            if (me == null) throw ApiException.unauthorized();
            RankContext ctx = new RankContext(c, uid);

            Set<String> subjects = new HashSet<>();
            int saved = 0, completed = 0;
            for (Map.Entry<String, EngagementDao.State> e : ctx.state.entrySet()) {
                if (e.getValue().saved) saved++;
                if (e.getValue().completed) completed++;
                if (ctx.catalog.byId.containsKey(e.getKey())) subjects.add(ctx.catalog.byId.get(e.getKey()).subject);
            }

            List<Map<String, Object>> searches = new ArrayList<>();
            for (PlannerDao.Search s : PlannerDao.searches(c, uid, 6)) searches.add(Map.of("q", s.query(), "at", s.at().getTime()));

            List<Map<String, Object>> recommended = new ArrayList<>();
            for (Scored x : ctx.recommendations(3)) recommended.add(ctx.view(x));

            List<Map<String, Object>> library = new ArrayList<>();
            for (String id : EngagementDao.savedIds(c, uid)) {
                Scored x = ctx.score(id, null);
                if (x != null) library.add(ctx.view(x));
            }

            List<Map<String, Object>> goals = new ArrayList<>();
            for (PlannerDao.Goal g : PlannerDao.goals(c, uid)) goals.add(GoalServlet.view(g));

            List<Map<String, Object>> board = new ArrayList<>();
            boolean meListed = false;
            int pos = 1;
            for (UserDao.User u : UserDao.leaderboard(c, 7)) {
                boolean isMe = u.id() == uid;
                meListed |= isMe;
                board.add(entry(pos++, u, isMe));
            }
            if (!meListed) board.add(entry(0, me, true));

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("saved", saved);
            stats.put("completed", completed);
            stats.put("subjects", subjects.size());
            stats.put("points", me.points());

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("user", Views.user(me));
            out.put("stats", stats);
            out.put("searches", searches);
            out.put("recommended", recommended);
            out.put("personalised", ctx.profile.total > 0);
            out.put("library", library);
            out.put("goals", goals);
            out.put("leaderboard", board);
            out.put("subjectNames", subjects.stream().map(Catalog::subjectName).sorted().toList());
            json(resp, out);
        }
    }

    private static Map<String, Object> entry(int pos, UserDao.User u, boolean me) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pos", pos);
        m.put("name", u.name());
        m.put("points", u.points());
        m.put("me", me);
        return m;
    }

    @Override
    protected void delete(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length != 1 || !p[0].equals("searches")) throw ApiException.notFound("Not found.");
        long uid = requireUser(req);
        try (Connection c = db()) {
            PlannerDao.clearSearches(c, uid);
            json(resp, Map.of("ok", true));
        }
    }
}
