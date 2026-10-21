package com.gyaansetu.web;

import com.gyaansetu.dao.EngagementDao;
import com.gyaansetu.dao.ResourceDao;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker;
import com.gyaansetu.engine.Ranker.Scored;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Everything needed to rank for one request: live stats plus the viewer's engagement and taste profile. */
public final class RankContext {
    public final Catalog catalog = Catalog.get();
    public final Map<String, Ranker.Stats> stats;
    public final Map<String, EngagementDao.State> state;
    public final Ranker.Profile profile;
    public final Long userId;

    public RankContext(Connection c, Long userId) throws SQLException {
        this.userId = userId;
        this.stats = ResourceDao.stats(c);
        this.state = EngagementDao.state(c, userId);
        this.profile = EngagementDao.profile(state, catalog);
    }

    public Ranker.Result rank(String q, Ranker.Filters f, Map<String, Integer> weights) {
        return Ranker.rank(catalog, q, f, weights, stats, profile);
    }

    public Ranker.Result rank(String q) {
        return rank(q, new Ranker.Filters(), Ranker.DEFAULT_WEIGHTS);
    }

    /** Scores one resource, optionally in the context of a search query. */
    public Scored score(String id, String q) {
        if (q != null && !q.isBlank()) {
            for (Scored x : rank(q).rows()) if (x.r.id.equals(id)) return x;
        }
        for (Scored x : rank(null).rows()) if (x.r.id.equals(id)) return x;
        return null;
    }

    /** Top resources the viewer has not saved or completed, leaning on their profile when they have one. */
    public List<Scored> recommendations(int limit) {
        List<Scored> rows = new java.util.ArrayList<>(rank(null).rows());
        rows.removeIf(x -> { EngagementDao.State s = state.get(x.r.id); return s != null && (s.saved || s.completed); });
        if (profile.total > 0) rows.sort((a, b) -> Double.compare(b.personal + b.score, a.personal + a.score));
        return rows.subList(0, Math.min(limit, rows.size()));
    }

    public Map<String, Object> view(Scored x) { return Views.resource(x, state.get(x.r.id)); }

    public static Map<String, Integer> parseWeights(String spec) {
        Map<String, Integer> w = new LinkedHashMap<>(Ranker.DEFAULT_WEIGHTS);
        if (spec == null || spec.isBlank()) return w;
        HashSet<String> known = new HashSet<>(List.of(Ranker.SIGNALS));
        for (String part : spec.split(",")) {
            String[] kv = part.split(":");
            if (kv.length != 2 || !known.contains(kv[0].trim())) continue;
            try { w.put(kv[0].trim(), Math.max(0, Math.min(100, Integer.parseInt(kv[1].trim())))); } catch (NumberFormatException ignored) { }
        }
        return w;
    }
}
