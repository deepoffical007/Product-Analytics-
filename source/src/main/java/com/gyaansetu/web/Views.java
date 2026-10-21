package com.gyaansetu.web;

import com.gyaansetu.dao.EngagementDao;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker;
import com.gyaansetu.engine.Ranker.Scored;

import java.util.LinkedHashMap;
import java.util.Map;

/** Converts domain objects into the JSON shapes the frontend reads. */
public final class Views {
    private Views() {}

    static double r2(double v) { return Math.round(v * 100) / 100.0; }

    static double r1(double v) { return Math.round(v * 10) / 10.0; }

    public static Map<String, Object> resource(Scored x, EngagementDao.State st) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", x.r.id);
        m.put("title", x.r.title);
        m.put("type", x.r.type);
        m.put("typeLabel", Catalog.typeLabel(x.r.type));
        m.put("typeCode", Catalog.typeCode(x.r.type));
        m.put("subject", x.r.subject);
        m.put("subjectName", Catalog.subjectName(x.r.subject));
        m.put("level", x.r.level);
        m.put("source", x.r.source);
        m.put("verified", Catalog.VERIFIED.contains(x.r.source));
        m.put("url", x.r.url);
        m.put("len", x.r.len);
        m.put("date", x.r.date);
        m.put("desc", x.r.desc);
        m.put("tags", x.r.tags);
        m.put("call", x.r.call);
        m.put("views", x.s.views);
        m.put("likes", x.s.likes);
        m.put("rating", r2(x.s.avgRating()));
        m.put("ratingCount", x.s.ratingCount);
        m.put("reviewCount", x.s.reviewCount);
        m.put("positivePct", Math.round(x.positive * 100));
        m.put("sentiment", r2(x.sentiment));
        m.put("score", r1(x.score * 100));
        m.put("quality", Ranker.quality(x.score));
        Map<String, Object> parts = new LinkedHashMap<>();
        x.parts.forEach((k, v) -> parts.put(k, r2(v * 100)));
        m.put("parts", parts);
        Map<String, Object> sig = new LinkedHashMap<>();
        for (String k : Ranker.SIGNALS) sig.put(k, r2(x.signal(k)));
        sig.put("bayes", r2(x.bayes));
        sig.put("helpful", r2(x.helpful));
        m.put("signals", sig);
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("liked", st != null && st.liked);
        u.put("saved", st != null && st.saved);
        u.put("completed", st != null && st.completed);
        u.put("rating", st == null ? null : st.rating);
        u.put("feedback", st == null || st.helpful == null ? null : (st.helpful ? "yes" : "no"));
        m.put("user", u);
        return m;
    }

    public static Map<String, Object> user(UserDao.User u) {
        if (u == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.id());
        m.put("name", u.name());
        m.put("email", u.email());
        m.put("guest", u.guest());
        m.put("points", u.points());
        return m;
    }
}
