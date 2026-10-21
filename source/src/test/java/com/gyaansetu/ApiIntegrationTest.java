package com.gyaansetu;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.catalina.startup.Tomcat;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/** Boots embedded Tomcat on a free port with an in-memory database and exercises the HTTP API end to end. */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ApiIntegrationTest {
    private static Tomcat tomcat;
    private static String base;
    private static HttpClient http;
    private static long threadId;

    record Res(int status, JsonElement body, String raw) {
        JsonObject obj() { return body.getAsJsonObject(); }
    }

    @BeforeAll
    static void start() throws Exception {
        System.setProperty("DB_URL", "jdbc:h2:mem:api;DB_CLOSE_DELAY=-1;MODE=MySQL;DATABASE_TO_LOWER=TRUE");
        System.setProperty("ANTHROPIC_API_KEY", " ");   // blank: force offline AI so the test never calls the network
        tomcat = Launcher.start(0, new File("src/main/webapp"));
        base = "http://localhost:" + tomcat.getConnector().getLocalPort();
        http = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
    }

    @AfterAll
    static void stop() throws Exception {
        tomcat.stop();
        tomcat.destroy();
        System.clearProperty("DB_URL");
        System.clearProperty("ANTHROPIC_API_KEY");
    }

    private static Res send(HttpRequest.Builder b) throws Exception {
        HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        JsonElement el = null;
        try { el = JsonParser.parseString(r.body()); } catch (RuntimeException ignored) { }
        return new Res(r.statusCode(), el, r.body());
    }

    private static Res get(String path) throws Exception {
        return send(HttpRequest.newBuilder(URI.create(base + path)).GET());
    }

    private static Res call(String method, String path, String json) throws Exception {
        return send(HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json").header("X-Requested-With", "GyaanSetu")
                .method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json)));
    }

    private static Res post(String path, String json) throws Exception { return call("POST", path, json); }

    private static Res upload(String filename, byte[] data) throws Exception {
        String boundary = "----gs" + System.nanoTime();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(data);
        out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return send(HttpRequest.newBuilder(URI.create(base + "/api/ai/upload"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary).header("X-Requested-With", "GyaanSetu")
                .POST(HttpRequest.BodyPublishers.ofByteArray(out.toByteArray())));
    }

    @Test @Order(1)
    void staticPagesAndHealth() throws Exception {
        Res index = get("/");
        assertEquals(200, index.status());
        assertTrue(index.raw().contains("js/app.js"));
        assertEquals(200, get("/css/styles.css").status());
        assertEquals(200, get("/js/app.js").status());
        Res h = get("/api/health");
        assertEquals("ok", h.obj().get("status").getAsString());
        assertEquals(46, h.obj().get("resources").getAsInt());
        assertEquals("offline", h.obj().get("ai").getAsString());
        Res missing = get("/api/does-not-exist");
        assertEquals(404, missing.status());
        assertTrue(missing.obj().has("error"), "unknown API paths answer JSON");
        assertEquals(404, get("/api/resources/nope").status());
    }

    @Test @Order(2)
    void metaAndSearch() throws Exception {
        JsonObject meta = get("/api/meta").obj();
        assertEquals(8, meta.getAsJsonArray("subjects").size());
        assertEquals(5, meta.getAsJsonArray("types").size());
        assertTrue(meta.getAsJsonArray("suggestions").size() > 50);

        JsonObject s = get("/api/resources?q=python%20tutorial").obj();
        assertTrue(s.get("total").getAsInt() >= 5);
        JsonObject first = s.getAsJsonArray("items").get(0).getAsJsonObject();
        assertTrue(first.get("title").getAsString().toLowerCase().contains("python"));
        assertTrue(first.has("parts") && first.has("quality") && first.has("user"));

        JsonObject f = get("/api/resources?q=python&types=video&sort=rating").obj();
        for (JsonElement e : f.getAsJsonArray("items")) assertEquals("video", e.getAsJsonObject().get("type").getAsString());

        JsonArray byViews = get("/api/resources?q=machine%20learning&w=rel:0,rating:0,feedback:0,eng:0,pop:50,personal:0").obj().getAsJsonArray("items");
        long maxViews = 0;
        for (JsonElement e : byViews) maxViews = Math.max(maxViews, e.getAsJsonObject().get("views").getAsLong());
        assertEquals(maxViews, byViews.get(0).getAsJsonObject().get("views").getAsLong(),
                "with only the views weight, the most-viewed match ranks first");
        JsonObject d = get("/api/resources?q=machine%20learning").obj();
        assertNotEquals("ml10", d.getAsJsonArray("items").get(0).getAsJsonObject().get("id").getAsString());
    }

    @Test @Order(3)
    void securityRules() throws Exception {
        Res noHeader = send(HttpRequest.newBuilder(URI.create(base + "/api/auth/guest")).POST(HttpRequest.BodyPublishers.noBody()));
        assertEquals(403, noHeader.status(), "mutating requests without the CSRF header are rejected");
        assertEquals(401, post("/api/resources/py/like", null).status());
        assertEquals(401, get("/api/dashboard").status());
        assertEquals(400, post("/api/auth/signup", "{\"name\":\"A\",\"email\":\"bad\",\"password\":\"123\"}").status());
        assertEquals(400, post("/api/auth/login", "not json").status());
        assertEquals(401, post("/api/auth/login", "{\"email\":\"demo@gyaansetu.in\",\"password\":\"wrong\"}").status());
    }

    @Test @Order(4)
    void signupLoginAndEngagement() throws Exception {
        Res su = post("/api/auth/signup", "{\"name\":\"Test Student\",\"email\":\"test@example.com\",\"password\":\"secret12\"}");
        assertEquals(201, su.status());
        assertEquals(409, post("/api/auth/signup", "{\"name\":\"Again\",\"email\":\"TEST@example.com\",\"password\":\"secret12\"}").status());
        assertTrue(get("/api/auth/me").obj().get("signedIn").getAsBoolean());

        long likesBefore = get("/api/resources/la?view=0").obj().getAsJsonObject("item").get("likes").getAsLong();
        JsonObject like = post("/api/resources/la/like", null).obj();
        assertEquals(likesBefore + 1, like.getAsJsonObject("item").get("likes").getAsLong());
        assertTrue(like.getAsJsonObject("item").getAsJsonObject("user").get("liked").getAsBoolean());
        JsonObject unlike = post("/api/resources/la/like", null).obj();
        assertEquals(likesBefore, unlike.getAsJsonObject("item").get("likes").getAsLong());

        int countBefore = like.getAsJsonObject("item").get("ratingCount").getAsInt();
        assertEquals(countBefore + 1, post("/api/resources/la/rate", "{\"stars\":5}").obj().getAsJsonObject("item").get("ratingCount").getAsInt());
        JsonObject rerate = post("/api/resources/la/rate", "{\"stars\":3}").obj().getAsJsonObject("item");
        assertEquals(countBefore + 1, rerate.get("ratingCount").getAsInt(), "re-rating replaces the old rating");
        assertEquals(3, rerate.getAsJsonObject("user").get("rating").getAsInt());
        assertEquals(400, post("/api/resources/la/rate", "{\"stars\":9}").status());

        assertEquals(200, post("/api/resources/la/feedback", "{\"value\":\"yes\"}").status());
        assertEquals(400, post("/api/resources/la/feedback", "{\"value\":\"maybe\"}").status());
        assertEquals(400, post("/api/resources/la/reviews", "{\"body\":\"\"}").status());
        int reviewsBefore = get("/api/resources/la?view=0").obj().getAsJsonObject("item").get("reviewCount").getAsInt();
        assertEquals(200, post("/api/resources/la/reviews", "{\"body\":\"Great and helpful\"}").status());
        JsonObject second = post("/api/resources/la/reviews", "{\"body\":\"Not useful, really confusing and outdated\"}").obj();
        assertEquals("Review updated. Ranking updated.", second.get("message").getAsString());
        assertEquals(reviewsBefore + 1, second.getAsJsonObject("item").get("reviewCount").getAsInt(), "one review per learner per resource");

        long viewsBefore = get("/api/resources/la?view=0").obj().getAsJsonObject("item").get("views").getAsLong();
        JsonObject detail = get("/api/resources/la?q=linear%20algebra").obj();
        assertEquals(viewsBefore + 1, detail.getAsJsonObject("item").get("views").getAsLong());
        JsonObject mine = detail.getAsJsonArray("reviews").get(0).getAsJsonObject();
        assertTrue(mine.get("mine").getAsBoolean());
        assertEquals("Negative", mine.get("label").getAsString());
        assertEquals(5, detail.getAsJsonArray("checks").size());
        assertEquals(4, detail.getAsJsonArray("related").size());

        long reviewId = mine.get("id").getAsLong();
        assertTrue(post("/api/reviews/" + reviewId + "/vote", null).obj().get("voted").getAsBoolean());
        assertFalse(post("/api/reviews/" + reviewId + "/vote", null).obj().get("voted").getAsBoolean());
        assertEquals(404, post("/api/reviews/999999/vote", null).status());

        assertTrue(post("/api/resources/py/save", null).obj().getAsJsonObject("item").getAsJsonObject("user").get("saved").getAsBoolean());
        assertEquals(200, post("/api/resources/py/complete", null).status());
        get("/api/resources?q=dbms%20notes&log=1");
    }

    @Test @Order(5)
    void dashboardAndGoals() throws Exception {
        JsonObject d = get("/api/dashboard").obj();
        assertEquals(1, d.getAsJsonObject("stats").get("saved").getAsInt());
        assertEquals(1, d.getAsJsonObject("stats").get("completed").getAsInt());
        assertTrue(d.getAsJsonObject("stats").get("points").getAsInt() >= 10, "rate +2, review +5, complete +3");
        assertEquals("dbms notes", d.getAsJsonArray("searches").get(0).getAsJsonObject().get("q").getAsString());
        assertEquals(1, d.getAsJsonArray("library").size());
        assertTrue(d.get("personalised").getAsBoolean());
        boolean meOnBoard = false;
        for (JsonElement e : d.getAsJsonArray("leaderboard")) meOnBoard |= e.getAsJsonObject().get("me").getAsBoolean();
        assertTrue(meOnBoard);

        assertEquals(400, post("/api/goals", "{\"text\":\"Revise\",\"day\":\"Funday\"}").status());
        JsonArray goals = post("/api/goals", "{\"text\":\"Revise SQL joins\",\"day\":\"Tue\"}").obj().getAsJsonArray("goals");
        assertEquals(1, goals.size());
        long gid = goals.get(0).getAsJsonObject().get("id").getAsLong();
        assertTrue(call("PUT", "/api/goals/" + gid, "{\"done\":true}").obj().getAsJsonArray("goals").get(0).getAsJsonObject().get("done").getAsBoolean());
        JsonObject plan = post("/api/goals/plan", null).obj();
        assertEquals("offline", plan.get("mode").getAsString());
        assertTrue(plan.getAsJsonArray("goals").size() >= 5);
        assertEquals(200, call("DELETE", "/api/goals/" + gid, null).status());
        assertEquals(404, call("DELETE", "/api/goals/" + gid, null).status());
        assertEquals(200, call("DELETE", "/api/dashboard/searches", null).status());
        assertEquals(0, get("/api/dashboard").obj().getAsJsonArray("searches").size());
    }

    @Test @Order(6)
    void forum() throws Exception {
        assertEquals(4, get("/api/threads").obj().getAsJsonArray("threads").size());
        assertEquals(400, post("/api/threads", "{\"title\":\"Hi\",\"subject\":\"cs\"}").status());
        JsonObject created = post("/api/threads", "{\"title\":\"How does recursion work in Python?\",\"body\":\"Base cases confuse me.\",\"subject\":\"cs\"}").obj();
        threadId = created.getAsJsonObject("thread").get("id").getAsLong();
        assertEquals(1, post("/api/threads/" + threadId + "/vote", null).obj().get("votes").getAsInt());
        JsonObject draft = post("/api/threads/" + threadId + "/draft", null).obj();
        assertFalse(draft.get("text").getAsString().isBlank());
        assertEquals(201, post("/api/threads/" + threadId + "/answers", "{\"body\":\"A function that calls itself until it reaches a base case.\"}").status());
        JsonObject t = get("/api/threads/" + threadId).obj();
        assertEquals(1, t.getAsJsonArray("answers").size());
        assertFalse(t.getAsJsonArray("related").isEmpty());
        assertEquals(404, get("/api/threads/999999").status());
    }

    @Test @Order(7)
    void aiEndpointsOffline() throws Exception {
        String text = "Photosynthesis converts light energy into chemical energy in green plants. The light-dependent reactions happen in the "
                + "thylakoid membranes of the chloroplast. The Calvin cycle uses carbon dioxide to build sugar molecules in the stroma. "
                + "Chlorophyll absorbs mostly red and blue light and reflects green light. Oxygen is released as a by-product of splitting water.";
        String body = "{\"name\":\"notes\",\"text\":" + com.google.gson.JsonParser.parseString("\"" + text + "\"") + "}";
        JsonObject sum = post("/api/ai/summary", body).obj();
        assertEquals("offline", sum.get("mode").getAsString());
        assertTrue(sum.get("text").getAsString().contains("Key terms"));
        assertTrue(post("/api/ai/keypoints", body).obj().get("text").getAsString().startsWith("## Key Points"));
        JsonArray quiz = post("/api/ai/quiz", body).obj().getAsJsonArray("items");
        assertTrue(quiz.size() >= 3);
        JsonObject q0 = quiz.get(0).getAsJsonObject();
        int answer = q0.get("answer").getAsInt();
        assertTrue(answer >= 0 && answer < q0.getAsJsonArray("options").size());
        String ask = "{\"name\":\"notes\",\"text\":\"" + text + "\",\"messages\":[{\"role\":\"user\",\"content\":\"Where does the Calvin cycle happen?\"}]}";
        assertTrue(post("/api/ai/ask", ask).obj().get("text").getAsString().contains("stroma"));
        assertEquals(400, post("/api/ai/summary", "{\"text\":\"too short\"}").status());
        JsonObject path = post("/api/ai/path", "{\"q\":\"python tutorial\"}").obj();
        assertTrue(path.getAsJsonArray("steps").size() >= 3);
    }

    @Test @Order(8)
    void uploadsTextAndPdf() throws Exception {
        Res txt = upload("notes.txt", "Mitochondria are the powerhouse of the cell and produce ATP through cellular respiration.".getBytes(StandardCharsets.UTF_8));
        assertEquals(200, txt.status(), txt.raw());
        assertEquals("TXT", txt.obj().get("kind").getAsString());

        ByteArrayOutputStream pdf = new ByteArrayOutputStream();
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                cs.newLineAtOffset(50, 700);
                cs.showText("Newton's second law states that force equals mass times acceleration.");
                cs.endText();
            }
            doc.save(pdf);
        }
        Res p = upload("physics.pdf", pdf.toByteArray());
        assertEquals(200, p.status(), p.raw());
        assertEquals("PDF", p.obj().get("kind").getAsString());
        assertTrue(p.obj().get("text").getAsString().contains("force equals mass"));
        assertEquals(400, upload("virus.exe", new byte[]{1, 2, 3}).status());
    }

    @Test @Order(9)
    void demoAccountAndLogout() throws Exception {
        assertEquals(200, post("/api/auth/logout", null).status());
        assertFalse(get("/api/auth/me").obj().get("signedIn").getAsBoolean());
        assertEquals(200, post("/api/auth/login", "{\"email\":\"demo@gyaansetu.in\",\"password\":\"demo1234\"}").status());
        JsonObject d = get("/api/dashboard").obj();
        assertEquals("Yashika", d.getAsJsonObject("user").get("name").getAsString());
        assertEquals(3, d.getAsJsonObject("stats").get("saved").getAsInt());
        assertEquals(201, post("/api/auth/guest", null).status());
        assertTrue(get("/api/auth/me").obj().getAsJsonObject("user").get("guest").getAsBoolean());
    }
}
