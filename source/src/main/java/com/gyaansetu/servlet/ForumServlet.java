package com.gyaansetu.servlet;

import com.google.gson.JsonObject;
import com.gyaansetu.ai.ClaudeService;
import com.gyaansetu.ai.OfflineAi;
import com.gyaansetu.dao.ForumDao;
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
import java.util.List;
import java.util.Map;

/**
 * GET  /api/threads              list
 * POST /api/threads              {title, body, subject}
 * GET  /api/threads/{id}         thread, answers and related resources
 * POST /api/threads/{id}/answers {body, ai}
 * POST /api/threads/{id}/vote
 * POST /api/threads/{id}/draft   AI-drafted answer text (not saved)
 */
@WebServlet("/api/threads/*")
public class ForumServlet extends ApiServlet {

    private static Map<String, Object> view(ForumDao.Thread t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.id());
        m.put("author", t.author());
        m.put("title", t.title());
        m.put("body", t.body());
        m.put("subject", t.subject());
        m.put("subjectName", Catalog.subjectName(t.subject()));
        m.put("votes", t.votes());
        m.put("voted", t.voted());
        m.put("answers", t.answerCount());
        m.put("createdAt", t.createdAt().getTime());
        return m;
    }

    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        Long uid = userId(req);
        try (Connection c = db()) {
            if (p.length == 0) {
                List<Map<String, Object>> out = new ArrayList<>();
                for (ForumDao.Thread t : ForumDao.list(c, uid)) out.add(view(t));
                json(resp, Map.of("threads", out));
                return;
            }
            if (p.length != 1) throw ApiException.notFound("Not found.");
            ForumDao.Thread t = ForumDao.find(c, parseId(p[0]), uid);
            if (t == null) throw ApiException.notFound("This discussion does not exist.");
            List<Map<String, Object>> answers = new ArrayList<>();
            for (ForumDao.Answer a : ForumDao.answers(c, t.id())) {
                answers.add(Map.of("id", a.id(), "author", a.author(), "body", a.body(), "ai", a.ai(), "createdAt", a.createdAt().getTime()));
            }
            RankContext ctx = new RankContext(c, uid);
            List<Map<String, Object>> related = new ArrayList<>();
            for (Scored x : ctx.rank(t.title()).rows()) {
                related.add(ctx.view(x));
                if (related.size() == 3) break;
            }
            json(resp, Map.of("thread", view(t), "answers", answers, "related", related));
        }
    }

    @Override
    protected void post(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        long uid = requireUser(req);
        try (Connection c = db()) {
            UserDao.User me = UserDao.find(c, uid);
            if (me == null) throw ApiException.unauthorized();
            if (p.length == 0) {
                JsonObject b = body(req);
                String title = str(b, "title", 140), text = str(b, "body", 1000), subject = str(b, "subject", 20);
                if (title.length() < 8) throw ApiException.badRequest("Write a question of at least a few words.");
                if (!Catalog.SUBJECTS.containsKey(subject)) throw ApiException.badRequest("Choose a subject.");
                long id = ForumDao.create(c, uid, me.name(), title, text, subject, 0, null);
                UserDao.addPoints(c, uid, 5);
                json(resp, 201, Map.of("thread", view(ForumDao.find(c, id, uid)), "message", "Question posted. +5 points"));
                return;
            }
            if (p.length != 2) throw ApiException.notFound("Not found.");
            ForumDao.Thread t = ForumDao.find(c, parseId(p[0]), uid);
            if (t == null) throw ApiException.notFound("This discussion does not exist.");
            switch (p[1]) {
                case "answers" -> {
                    JsonObject b = body(req);
                    String text = str(b, "body", 2000);
                    boolean ai = b.has("ai") && b.get("ai").getAsBoolean();
                    if (text.length() < 10) throw ApiException.badRequest("Write a slightly longer answer.");
                    ForumDao.addAnswer(c, t.id(), uid, ai ? "GyaanSetu AI" : me.name(), text, ai, null);
                    if (!ai) UserDao.addPoints(c, uid, 5);
                    json(resp, 201, Map.of("message", ai ? "AI answer posted." : "Answer posted. +5 points"));
                }
                case "vote" -> json(resp, Map.of("votes", ForumDao.toggleVote(c, uid, t.id())));
                case "draft" -> {
                    RankContext ctx = new RankContext(c, uid);
                    List<String> titles = new ArrayList<>();
                    for (Scored x : ctx.rank(t.title() + " " + t.body()).rows()) {
                        titles.add(x.r.title);
                        if (titles.size() == 3) break;
                    }
                    String mode = "offline", note = "", text;
                    if (ClaudeService.enabled()) {
                        try {
                            text = ClaudeService.ask("A student asked this on GyaanSetu's study forum. Write a clear, friendly answer under 150 words in plain markdown. "
                                    + "If useful, end with one line suggesting one or two of these GyaanSetu resources by title: " + String.join("; ", titles) + ".\n\n"
                                    + "Subject: " + Catalog.subjectName(t.subject()) + "\nQuestion: " + t.title() + "\nDetails: " + (t.body().isBlank() ? "(none)" : t.body()));
                            mode = "claude";
                        } catch (ClaudeService.AiUnavailable e) {
                            note = e.getMessage() + " Showing an offline draft.";
                            text = OfflineAi.forumAnswer(t.title(), titles);
                        }
                    } else {
                        text = OfflineAi.forumAnswer(t.title(), titles);
                        note = "Offline mode: add ANTHROPIC_API_KEY on the server for full AI answers.";
                    }
                    json(resp, Map.of("text", text, "mode", mode, "message", note));
                }
                default -> throw ApiException.notFound("Not found.");
            }
        }
    }
}
