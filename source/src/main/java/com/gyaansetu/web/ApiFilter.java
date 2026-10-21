package com.gyaansetu.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Applies to every /api request: no caching, basic security headers, and CSRF protection.
 * State-changing requests must carry the custom X-Requested-With header, which browsers
 * will not let another site add to a cross-origin request without a CORS preflight.
 */
@WebFilter(urlPatterns = "/api/*")
public class ApiFilter extends HttpFilter {
    public static final String CSRF_HEADER = "X-Requested-With";
    public static final String CSRF_VALUE = "GyaanSetu";

    @Override
    protected void doFilter(HttpServletRequest req, HttpServletResponse resp, FilterChain chain) throws IOException, ServletException {
        resp.setHeader("Cache-Control", "no-store");
        resp.setHeader("X-Content-Type-Options", "nosniff");
        resp.setHeader("X-Frame-Options", "DENY");
        resp.setHeader("Referrer-Policy", "same-origin");
        String m = req.getMethod();
        boolean mutating = !(m.equals("GET") || m.equals("HEAD") || m.equals("OPTIONS"));
        if (mutating && !CSRF_VALUE.equals(req.getHeader(CSRF_HEADER))) {
            resp.setStatus(403);
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.getWriter().write("{\"error\":\"Missing request header. Use the GyaanSetu web app or send X-Requested-With: GyaanSetu.\",\"status\":403}");
            return;
        }
        chain.doFilter(req, resp);
    }
}
