package com.gyaansetu;

import com.gyaansetu.db.Config;
import com.gyaansetu.servlet.AiServlet;
import com.gyaansetu.servlet.AuthServlet;
import com.gyaansetu.servlet.DashboardServlet;
import com.gyaansetu.servlet.ForumServlet;
import com.gyaansetu.servlet.GoalServlet;
import com.gyaansetu.servlet.HealthServlet;
import com.gyaansetu.servlet.MetaServlet;
import com.gyaansetu.servlet.NotFoundServlet;
import com.gyaansetu.servlet.ResourceServlet;
import com.gyaansetu.servlet.ReviewServlet;
import com.gyaansetu.web.ApiFilter;
import com.gyaansetu.web.AppListener;
import jakarta.servlet.MultipartConfigElement;
import jakarta.servlet.http.HttpServlet;
import org.apache.catalina.Context;
import org.apache.catalina.LifecycleException;
import org.apache.catalina.Wrapper;
import org.apache.catalina.servlets.DefaultServlet;
import org.apache.catalina.startup.Tomcat;
import org.apache.tomcat.util.descriptor.web.ErrorPage;
import org.apache.tomcat.util.descriptor.web.FilterDef;
import org.apache.tomcat.util.descriptor.web.FilterMap;
import org.apache.tomcat.util.http.Rfc6265CookieProcessor;

import java.awt.Desktop;
import java.io.File;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Runs GyaanSetu on embedded Tomcat: {@code java -jar gyaansetu.jar} from the distribution,
 * or {@code mvn compile exec:exec} from the source project.
 * Servlets are registered here directly; the same classes also deploy as target/gyaansetu.war
 * on a standalone Tomcat 10.1, where their @WebServlet annotations are used instead.
 */
public final class Launcher {
    private Launcher() {}

    public static void main(String[] args) throws Exception {
        String fixedPort = Config.get("PORT", "");
        int port = fixedPort.isEmpty() ? freePort(8080, 8099) : Integer.parseInt(fixedPort);
        Tomcat tomcat = start(port, webRoot());
        String url = "http://localhost:" + tomcat.getConnector().getLocalPort() + "/";
        System.out.println();
        System.out.println("  GyaanSetu is running:  " + url);
        System.out.println("  Demo login:            demo@gyaansetu.in / demo1234");
        System.out.println("  Database:              " + com.gyaansetu.db.Database.url().replaceAll(";.*", ""));
        System.out.println("  Keep this window open. Press Ctrl+C to stop.");
        System.out.println();
        openBrowser(url);
        tomcat.getServer().await();
    }

    /** Finds the web files: WEB_DIR, then src/main/webapp (source project), then web/ next to the jar (distribution). */
    static File webRoot() {
        String configured = Config.get("WEB_DIR", "");
        if (!configured.isEmpty()) return new File(configured).getAbsoluteFile();
        File dev = new File("src/main/webapp");
        if (new File(dev, "index.html").isFile()) return dev.getAbsoluteFile();
        try {
            File jar = new File(Launcher.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            File dist = new File(jar.getParentFile(), "web");
            if (new File(dist, "index.html").isFile()) return dist;
        } catch (Exception ignored) { }
        throw new IllegalStateException("Cannot find the web files. Run from the GyaanSetu folder, or set WEB_DIR.");
    }

    private static int freePort(int from, int to) {
        for (int p = from; p <= to; p++) {
            try (ServerSocket s = new ServerSocket(p)) {
                s.setReuseAddress(true);
                return p;
            } catch (IOException busy) { /* try the next port */ }
        }
        return 0;
    }

    private static void openBrowser(String url) {
        if (!Config.get("NO_BROWSER", "").isEmpty()) return;
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(URI.create(url));
            }
        } catch (Exception | Error ignored) { /* headless or no browser: the URL is printed above */ }
    }

    /** Starts Tomcat serving webRoot as static files plus the API servlets. Port 0 picks a free port. */
    public static Tomcat start(int port, File webRoot) throws LifecycleException, IOException {
        Tomcat tomcat = new Tomcat();
        File base = Files.createTempDirectory("gyaansetu-tomcat").toFile();
        base.deleteOnExit();
        tomcat.setBaseDir(base.getAbsolutePath());
        tomcat.setPort(port);
        tomcat.getConnector();

        Context ctx = tomcat.addContext("", webRoot.getAbsolutePath());
        ctx.setSessionTimeout(60 * 24 * 7);
        ctx.setUseHttpOnly(true);
        Rfc6265CookieProcessor cookies = new Rfc6265CookieProcessor();
        cookies.setSameSiteCookies("lax");
        ctx.setCookieProcessor(cookies);
        ctx.addApplicationListener(AppListener.class.getName());

        FilterDef fd = new FilterDef();
        fd.setFilterName("api");
        fd.setFilter(new ApiFilter());
        fd.setFilterClass(ApiFilter.class.getName());
        ctx.addFilterDef(fd);
        FilterMap fm = new FilterMap();
        fm.setFilterName("api");
        fm.addURLPattern("/api/*");
        ctx.addFilterMap(fm);

        Map<String, HttpServlet> api = new LinkedHashMap<>();
        api.put("/api/auth/*", new AuthServlet());
        api.put("/api/resources/*", new ResourceServlet());
        api.put("/api/reviews/*", new ReviewServlet());
        api.put("/api/meta", new MetaServlet());
        api.put("/api/dashboard/*", new DashboardServlet());
        api.put("/api/goals/*", new GoalServlet());
        api.put("/api/threads/*", new ForumServlet());
        api.put("/api/ai/*", new AiServlet());
        api.put("/api/health", new HealthServlet());
        api.put("/api/*", new NotFoundServlet());
        int i = 0;
        for (Map.Entry<String, HttpServlet> e : api.entrySet()) {
            String name = "api" + (i++);
            Wrapper w = Tomcat.addServlet(ctx, name, e.getValue());
            if (e.getValue() instanceof AiServlet) {
                w.setMultipartConfigElement(new MultipartConfigElement(null, 25L * 1024 * 1024, 26L * 1024 * 1024, 1024 * 1024));
            }
            ctx.addServletMappingDecoded(e.getKey(), name);
        }

        Wrapper files = Tomcat.addServlet(ctx, "default", new DefaultServlet());
        files.addInitParameter("listings", "false");
        ctx.addServletMappingDecoded("/", "default");
        Tomcat.addDefaultMimeTypeMappings(ctx);
        ctx.addWelcomeFile("index.html");
        ErrorPage notFound = new ErrorPage();
        notFound.setErrorCode(404);
        notFound.setLocation("/404.html");
        ctx.addErrorPage(notFound);

        tomcat.start();
        return tomcat;
    }
}
