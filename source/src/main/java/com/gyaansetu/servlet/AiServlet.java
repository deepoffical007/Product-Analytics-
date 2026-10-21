package com.gyaansetu.servlet;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.gyaansetu.ai.ClaudeService;
import com.gyaansetu.ai.ClaudeService.Turn;
import com.gyaansetu.ai.OfflineAi;
import com.gyaansetu.dao.UserDao;
import com.gyaansetu.engine.Catalog;
import com.gyaansetu.engine.Ranker.Scored;
import com.gyaansetu.web.ApiException;
import com.gyaansetu.web.ApiServlet;
import com.gyaansetu.web.RankContext;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * GET  /api/ai/status
 * POST /api/ai/upload      multipart "file" (.pdf, .txt, .md, .csv, .json) -> extracted text
 * POST /api/ai/summary     {name, text}
 * POST /api/ai/keypoints   {name, text}
 * POST /api/ai/quiz        {name, text}
 * POST /api/ai/ask         {name, text, messages: [{role, content}]}
 * POST /api/ai/path        {q}  ordered learning path from the top search results
 * Uses Claude when ANTHROPIC_API_KEY is set on the server, otherwise the offline engine.
 */
@WebServlet("/api/ai/*")
@MultipartConfig(maxFileSize = 25 * 1024 * 1024, maxRequestSize = 26 * 1024 * 1024, fileSizeThreshold = 1024 * 1024)
public class AiServlet extends ApiServlet {
    private static final int MAX_MATERIAL = 60_000;
    private static final String OFFLINE_NOTE = "Offline mode: add ANTHROPIC_API_KEY on the server for answers written by Claude.";

    @Override
    protected void get(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        if (p.length != 1 || !p[0].equals("status")) throw ApiException.notFound("Not found.");
        json(resp, Map.of("mode", ClaudeService.enabled() ? "claude" : "offline", "model", ClaudeService.enabled() ? ClaudeService.model() : ""));
    }

    @Override
    protected void post(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String[] p = path(req);
        String action = p.length == 1 ? p[0] : "";
        if (action.equals("upload")) { upload(req, resp); return; }
        JsonObject b = body(req);
        Map<String, Object> out = switch (action) {
            case "summary", "keypoints" -> textTask(action, b);
            case "quiz" -> quiz(b);
            case "ask" -> ask(b);
            case "path" -> path(req, b);
            default -> throw ApiException.notFound("Not found.");
        };
        Long uid = userId(req);
        if (uid != null && "claude".equals(out.get("mode"))) {
            try (Connection c = db()) { UserDao.addPoints(c, uid, 1); }
        }
        json(resp, out);
    }

    private static String material(JsonObject b) {
        String text = b.has("text") && !b.get("text").isJsonNull() ? b.get("text").getAsString().trim() : "";
        if (text.length() < 40) throw ApiException.badRequest("Add some study material first: at least a few sentences.");
        return text.length() > MAX_MATERIAL ? text.substring(0, MAX_MATERIAL) : text;
    }

    private static String materialPrompt(JsonObject b, String text) {
        String name = b.has("name") ? b.get("name").getAsString() : "Study notes";
        return "Study material title: " + name + "\n\n<material>\n" + text + "\n</material>";
    }

    private static Map<String, Object> result(String mode, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mode", mode);
        m.put("message", note);
        return m;
    }

    private Map<String, Object> textTask(String action, JsonObject b) {
        String text = material(b);
        boolean summary = action.equals("summary");
        if (ClaudeService.enabled()) {
            String prompt = summary
                    ? "You are GyaanSetu's study assistant. Summarise the study material for a student revising it.\n"
                      + "Format in plain markdown: a 2-3 sentence overview paragraph, then \"## Key Concepts\" with 4-6 bullet points "
                      + "(bold the term at the start of each), then \"## Remember\" with one line to memorise. No preamble.\n\n"
                    : "You are GyaanSetu's study assistant. Extract the most important key points from the study material.\n"
                      + "Format in plain markdown: \"## Key Points\" with 6-8 bullets, each \"**Term**: short explanation\", then "
                      + "\"## Likely exam questions\" with 3 bullets, then \"## Common mistakes\" with 2 bullets. No preamble.\n\n";
            try {
                Map<String, Object> r = result("claude", "");
                r.put("text", ClaudeService.ask(prompt + materialPrompt(b, text)));
                return r;
            } catch (ClaudeService.AiUnavailable e) {
                Map<String, Object> r = result("offline", e.getMessage() + " Showing an offline result.");
                r.put("text", summary ? OfflineAi.summary(text) : OfflineAi.keyPoints(text));
                return r;
            }
        }
        Map<String, Object> r = result("offline", OFFLINE_NOTE);
        r.put("text", summary ? OfflineAi.summary(text) : OfflineAi.keyPoints(text));
        return r;
    }

    private Map<String, Object> quiz(JsonObject b) {
        String text = material(b);
        String note = OFFLINE_NOTE;
        if (ClaudeService.enabled()) {
            try {
                JsonElement out = ClaudeService.askJson("You are GyaanSetu's study assistant. Write 5 multiple-choice questions that test understanding "
                        + "of the study material, mixing recall and application. Each has 4 options and exactly one correct answer.\n"
                        + "Reply with a JSON array: [{\"q\": \"question\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"answer\": 0, "
                        + "\"why\": \"one-sentence explanation\"}] where answer is the 0-based index of the correct option.\n\n" + materialPrompt(b, text));
                List<Map<String, Object>> items = new ArrayList<>();
                if (out.isJsonArray()) {
                    for (JsonElement e : out.getAsJsonArray()) {
                        if (!e.isJsonObject()) continue;
                        JsonObject o = e.getAsJsonObject();
                        if (!o.has("q") || !o.has("options") || !o.get("options").isJsonArray()) continue;
                        List<String> options = new ArrayList<>();
                        for (JsonElement op : o.getAsJsonArray("options")) if (options.size() < 4) options.add(op.getAsString());
                        if (options.size() < 2) continue;
                        int answer = o.has("answer") ? Math.max(0, Math.min(options.size() - 1, o.get("answer").getAsInt())) : 0;
                        Map<String, Object> q = new LinkedHashMap<>();
                        q.put("q", o.get("q").getAsString());
                        q.put("options", options);
                        q.put("answer", answer);
                        q.put("why", o.has("why") ? o.get("why").getAsString() : "");
                        items.add(q);
                        if (items.size() == 8) break;
                    }
                }
                if (!items.isEmpty()) {
                    Map<String, Object> r = result("claude", "");
                    r.put("items", items);
                    return r;
                }
                note = "The AI answer was not in the expected format. Showing an offline quiz.";
            } catch (ClaudeService.AiUnavailable e) {
                note = e.getMessage() + " Showing an offline quiz.";
            }
        }
        Map<String, Object> r = result("offline", note);
        r.put("items", OfflineAi.quiz(text, text.hashCode()));
        return r;
    }

    private Map<String, Object> ask(JsonObject b) {
        String text = material(b);
        List<Turn> turns = new ArrayList<>();
        JsonArray msgs = b.has("messages") && b.get("messages").isJsonArray() ? b.getAsJsonArray("messages") : new JsonArray();
        for (JsonElement e : msgs) {
            if (!e.isJsonObject()) continue;
            JsonObject o = e.getAsJsonObject();
            String role = o.has("role") ? o.get("role").getAsString() : "user";
            String content = o.has("content") ? o.get("content").getAsString().trim() : "";
            if (content.isEmpty()) continue;
            turns.add(new Turn("assistant".equals(role) ? "assistant" : "user", content.length() > 4000 ? content.substring(0, 4000) : content));
        }
        while (turns.size() > 10) turns.remove(0);
        while (!turns.isEmpty() && !turns.get(0).role().equals("user")) turns.remove(0);
        if (turns.isEmpty() || !turns.get(turns.size() - 1).role().equals("user")) throw ApiException.badRequest("Ask a question first.");
        String question = turns.get(turns.size() - 1).content();
        if (ClaudeService.enabled()) {
            String rules = "You are GyaanSetu's AI study assistant helping a student with their study material. Answer the student's questions "
                    + "using the material below. If the material does not cover a question, say so briefly, then give a short general answer "
                    + "starting with \"Beyond your material:\". Keep answers under 160 words, use simple language, and use markdown bullets "
                    + "or **bold** where it helps.\n\n" + materialPrompt(b, text);
            List<Turn> all = new ArrayList<>(turns);
            all.set(0, new Turn("user", rules + "\n\nStudent: " + turns.get(0).content()));
            try {
                Map<String, Object> r = result("claude", "");
                r.put("text", ClaudeService.chat(all));
                return r;
            } catch (ClaudeService.AiUnavailable e) {
                Map<String, Object> r = result("offline", e.getMessage() + " Showing an offline answer.");
                r.put("text", OfflineAi.answer(text, question));
                return r;
            }
        }
        Map<String, Object> r = result("offline", OFFLINE_NOTE);
        r.put("text", OfflineAi.answer(text, question));
        return r;
    }

    private Map<String, Object> path(HttpServletRequest req, JsonObject b) throws Exception {
        String q = str(b, "q", 120);
        if (q.isBlank()) throw ApiException.badRequest("Search for a topic first.");
        List<Scored> cands;
        RankContext ctx;
        try (Connection c = db()) {
            ctx = new RankContext(c, userId(req));
            cands = ctx.rank(q).rows();
        }
        cands = cands.subList(0, Math.min(10, cands.size()));
        if (cands.isEmpty()) throw ApiException.notFound("No resources match this search.");
        String note = OFFLINE_NOTE;
        if (ClaudeService.enabled()) {
            StringBuilder list = new StringBuilder("[");
            for (Scored x : cands) {
                list.append(GSON.toJson(Map.of("id", x.r.id, "title", x.r.title, "type", x.r.type, "level", x.r.level,
                        "source", x.r.source, "quality", Math.round(x.score * 100), "about", x.r.desc))).append(',');
            }
            list.setCharAt(list.length() - 1, ']');
            try {
                JsonElement out = ClaudeService.askJson("You are GyaanSetu's study guide. A learner searched for \"" + q + "\". From the candidate "
                        + "resources below, choose 3 to 5 and order them into a learning path, from where to start to where to finish. Prefer high "
                        + "quality scores, mix content types where it helps, and move from beginner to advanced.\n"
                        + "Reply with JSON in this shape: {\"intro\": \"one sentence on how to use the path\", \"steps\": [{\"id\": \"resource id from the list\", "
                        + "\"why\": \"one sentence on why this step comes here\"}]}\n\nCandidates:\n" + list);
                List<Map<String, Object>> steps = new ArrayList<>();
                if (out.isJsonObject() && out.getAsJsonObject().has("steps") && out.getAsJsonObject().get("steps").isJsonArray()) {
                    for (JsonElement e : out.getAsJsonObject().getAsJsonArray("steps")) {
                        if (!e.isJsonObject() || !e.getAsJsonObject().has("id")) continue;
                        String id = e.getAsJsonObject().get("id").getAsString();
                        Scored x = cands.stream().filter(s -> s.r.id.equals(id)).findFirst().orElse(null);
                        if (x == null) continue;
                        steps.add(step(ctx, x, e.getAsJsonObject().has("why") ? e.getAsJsonObject().get("why").getAsString() : ""));
                    }
                }
                if (!steps.isEmpty()) {
                    Map<String, Object> r = result("claude", "");
                    JsonElement intro = out.getAsJsonObject().get("intro");
                    r.put("intro", intro == null || intro.isJsonNull() ? "" : intro.getAsString());
                    r.put("steps", steps);
                    return r;
                }
                note = "The AI answer did not match the results, so an offline ordering is shown.";
            } catch (ClaudeService.AiUnavailable e) {
                note = e.getMessage() + " Showing an offline ordering.";
            }
        }
        List<Scored> ordered = new ArrayList<>(cands.subList(0, Math.min(5, cands.size())));
        List<String> levels = List.of("Beginner", "Intermediate", "Advanced");
        ordered.sort((a, z) -> a.r.level.equals(z.r.level) ? Double.compare(z.score, a.score) : Integer.compare(levels.indexOf(a.r.level), levels.indexOf(z.r.level)));
        List<Map<String, Object>> steps = new ArrayList<>();
        for (Scored x : ordered.subList(0, Math.min(4, ordered.size()))) {
            steps.add(step(ctx, x, x.r.level + " " + Catalog.typeLabel(x.r.type).toLowerCase(Locale.ROOT) + " with a quality score of " + Math.round(x.score * 100) + "."));
        }
        Map<String, Object> r = result("offline", note);
        r.put("intro", "Ordered from beginner to advanced, best-scored first.");
        r.put("steps", steps);
        return r;
    }

    private static Map<String, Object> step(RankContext ctx, Scored x, String why) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("why", why);
        m.put("item", ctx.view(x));
        return m;
    }

    private void upload(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        String ct = req.getContentType();
        if (ct == null || !ct.toLowerCase(Locale.ROOT).startsWith("multipart/form-data")) throw ApiException.badRequest("Upload a file using multipart/form-data.");
        Part part;
        try {
            part = req.getPart("file");
        } catch (IllegalStateException e) {
            throw new ApiException(413, "This file is larger than 25 MB. Try a smaller file.");
        }
        if (part == null || part.getSize() == 0) throw ApiException.badRequest("Choose a file to upload.");
        String name = part.getSubmittedFileName() == null ? "upload" : part.getSubmittedFileName().replaceAll("[\\\\/]", "_");
        String lower = name.toLowerCase(Locale.ROOT);
        String text, kind;
        try (InputStream in = part.getInputStream()) {
            if (lower.endsWith(".pdf")) {
                kind = "PDF";
                try (PDDocument doc = Loader.loadPDF(in.readAllBytes())) {
                    PDFTextStripper stripper = new PDFTextStripper();
                    stripper.setEndPage(Math.min(doc.getNumberOfPages(), 80));
                    text = stripper.getText(doc);
                } catch (java.io.IOException e) {
                    throw ApiException.badRequest("This PDF could not be read. Try a different file.");
                }
            } else if (lower.matches(".*\\.(txt|md|csv|json)$")) {
                kind = "TXT";
                text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } else {
                throw ApiException.badRequest("Upload a PDF, .txt, .md, .csv or .json file.");
            }
        }
        text = text.replace("\u0000", "").replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
        if (text.length() < 40) throw ApiException.badRequest("No readable text found. Scanned PDFs need OCR first; try a text-based PDF or paste the text.");
        boolean truncated = text.length() > MAX_MATERIAL;
        if (truncated) text = text.substring(0, MAX_MATERIAL);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", name);
        out.put("kind", kind);
        out.put("chars", text.length());
        out.put("truncated", truncated);
        out.put("text", text);
        json(resp, out);
    }
}
