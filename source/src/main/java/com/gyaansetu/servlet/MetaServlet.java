package com.gyaansetu.servlet;

import com.gyaansetu.ai.ClaudeService;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker;
import com.gyaansetu.engine.Resource;
import com.gyaansetu.web.ApiServlet;
import com.gyaansetu.web.RankContext;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/** GET /api/meta: subjects, content types, trending searches, autocomplete tags, AI mode and totals. */
@WebServlet("/api/meta")
public class MetaServlet extends ApiServlet {
    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        Catalog cat = Catalog.get();
        Map<String, Integer> bySubject = new LinkedHashMap<>(), byType = new LinkedHashMap<>();
        TreeSet<String> tags = new TreeSet<>();
        for (Resource r : cat.items) {
            bySubject.merge(r.subject, 1, Integer::sum);
            byType.merge(r.type, 1, Integer::sum);
            tags.addAll(r.tags);
        }
        List<Map<String, Object>> subjects = new ArrayList<>();
        Catalog.SUBJECTS.forEach((k, v) -> subjects.add(Map.of("key", k, "name", v[0], "dewey", v[1], "count", bySubject.getOrDefault(k, 0))));
        List<Map<String, Object>> types = new ArrayList<>();
        Catalog.TYPES.forEach((k, v) -> types.add(Map.of("key", k, "label", v[0], "code", v[1], "count", byType.getOrDefault(k, 0))));

        Map<String, Object> out = new LinkedHashMap<>();
        try (Connection c = db()) {
            RankContext ctx = new RankContext(c, null);
            List<Map<String, Object>> trending = new ArrayList<>();
            for (String t : Catalog.TRENDING) {
                Ranker.Result r = ctx.rank(t);
                trending.add(Map.of("q", t, "count", r.rows().size()));
            }
            out.put("subjects", subjects);
            out.put("types", types);
            out.put("trending", trending);
            out.put("suggestions", tags);
            out.put("ai", Map.of("mode", ClaudeService.enabled() ? "claude" : "offline", "model", ClaudeService.enabled() ? ClaudeService.model() : ""));
            out.put("totals", Map.of("resources", cat.items.size(), "reviews", count(c, "reviews"), "learners", count(c, "users"), "threads", count(c, "threads")));
            out.put("weights", Ranker.DEFAULT_WEIGHTS);
        }
        json(resp, out);
    }

    private static int count(Connection c, String table) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM " + table); ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getInt(1);
        }
    }
}
