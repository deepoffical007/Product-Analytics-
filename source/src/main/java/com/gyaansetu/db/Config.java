package com.gyaansetu.db;

/** Reads settings from JVM system properties first, then environment variables. */
public final class Config {
    private Config() {}

    public static String get(String key, String fallback) {
        String v = System.getProperty(key);          // an explicitly set property wins, even when blank
        if (v == null) v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : v.trim();
    }

    /** Default: a local H2 file database in MySQL compatibility mode, created on first run. */
    public static String dbUrl() {
        return get("DB_URL", "jdbc:h2:file:" + System.getProperty("user.home").replace('\\', '/')
                + "/gyaansetu-data/gyaansetu;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE");
    }

    public static String dbUser() { return get("DB_USER", "sa"); }

    public static String dbPassword() { return get("DB_PASSWORD", ""); }

    public static String aiModel() { return get("AI_MODEL", "claude-opus-5-5"); }

    public static boolean aiKeyPresent() {
        return !get("ANTHROPIC_API_KEY", "").isEmpty() || !get("ANTHROPIC_AUTH_TOKEN", "").isEmpty();
    }
}
