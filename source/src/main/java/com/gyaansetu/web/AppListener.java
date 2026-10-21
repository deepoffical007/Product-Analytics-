package com.gyaansetu.web;

import com.gyaansetu.ai.ClaudeService;
import com.gyaansetu.dao.ResourceDao;
import com.gyaansetu.db.Database;
import com.gyaansetu.db.Seeder;
import com.gyaansetu.engine.Catalog;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.logging.Logger;

/** Initialises the database, seeds sample data on first run and loads the search catalogue. */
@WebListener
public class AppListener implements ServletContextListener {
    private static final Logger LOG = Logger.getLogger(AppListener.class.getName());

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        Database.init();
        Seeder.seedIfEmpty();
        try (Connection c = Database.get()) {
            Catalog.set(new Catalog(ResourceDao.loadAll(c)));
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load the catalogue", e);
        }
        LOG.info("GyaanSetu ready: " + Catalog.get().items.size() + " resources, database " + Database.url()
                + ", AI " + (ClaudeService.enabled() ? "Claude (" + ClaudeService.model() + ")" : "offline mode"));
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        Database.shutdown();
    }
}
