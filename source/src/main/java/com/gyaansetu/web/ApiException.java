package com.gyaansetu.web;

/** An error with an HTTP status and a message that is safe to show to users. */
public class ApiException extends RuntimeException {
    public final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException badRequest(String m) { return new ApiException(400, m); }
    public static ApiException notFound(String m) { return new ApiException(404, m); }
    public static ApiException unauthorized() { return new ApiException(401, "Please sign in to continue."); }
}
