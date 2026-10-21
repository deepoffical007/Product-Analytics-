package com.gyaansetu.db;

import org.h2.jdbcx.JdbcConnectionPool;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Statement;
import java.util.logging.Logger;

/** Owns the JDBC DataSource. H2 URLs get a connection pool; other URLs (MySQL) use DriverManager. */
public final class Database {
    private static volatile DataSource dataSource;
    private static volatile String url;

    private Database() {}

    public static synchronized void init() {
        if (dataSource != null) return;
        url = Config.dbUrl();
        if (url.startsWith("jdbc:h2:")) {
            JdbcConnectionPool pool = JdbcConnectionPool.create(url, Config.dbUser(), Config.dbPassword());
            pool.setMaxConnections(30);
            dataSource = pool;
        } else {
            dataSource = new DriverManagerDataSource(url, Config.dbUser(), Config.dbPassword());
        }
        runScript("/schema.sql");
    }

    public static Connection get() throws SQLException {
        if (dataSource == null) init();
        return dataSource.getConnection();
    }

    public static String url() { return url; }

    public static synchronized void shutdown() {
        if (dataSource instanceof JdbcConnectionPool pool) pool.dispose();
        dataSource = null;
    }

    static void runScript(String resource) {
        String sql;
        try (InputStream in = Database.class.getResourceAsStream(resource)) {
            if (in == null) throw new IllegalStateException("Missing " + resource);
            sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read " + resource, e);
        }
        try (Connection c = get(); Statement st = c.createStatement()) {
            for (String part : sql.split(";")) {
                String stmt = part.lines().filter(l -> !l.trim().startsWith("--")).reduce("", (a, b) -> a + "\n" + b).trim();
                if (!stmt.isEmpty()) st.execute(stmt);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Schema setup failed: " + e.getMessage(), e);
        }
    }

    /** Minimal DataSource over DriverManager, used for MySQL and other non-H2 URLs. */
    static final class DriverManagerDataSource implements DataSource {
        private final String url, user, password;

        DriverManagerDataSource(String url, String user, String password) {
            this.url = url; this.user = user; this.password = password;
        }

        @Override public Connection getConnection() throws SQLException { return DriverManager.getConnection(url, user, password); }
        @Override public Connection getConnection(String u, String p) throws SQLException { return DriverManager.getConnection(url, u, p); }
        @Override public PrintWriter getLogWriter() { return null; }
        @Override public void setLogWriter(PrintWriter out) {}
        @Override public void setLoginTimeout(int seconds) { DriverManager.setLoginTimeout(seconds); }
        @Override public int getLoginTimeout() { return DriverManager.getLoginTimeout(); }
        @Override public Logger getParentLogger() throws SQLFeatureNotSupportedException { throw new SQLFeatureNotSupportedException(); }
        @Override public <T> T unwrap(Class<T> iface) throws SQLException { throw new SQLException("Not a wrapper"); }
        @Override public boolean isWrapperFor(Class<?> iface) { return false; }
    }
}
