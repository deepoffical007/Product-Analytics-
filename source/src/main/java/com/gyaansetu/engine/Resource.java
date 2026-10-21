package com.gyaansetu.engine;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Static descriptive data for one learning resource, plus its search index entry. */
public final class Resource {
    public final String id, title, type, subject, level, source, url, len, date, desc, call;
    public final List<String> tags;
    final Map<String, Double> tf = new HashMap<>();
    double dl;

    public Resource(String id, String title, String type, String subject, String level, String source, String url,
                    String len, String date, String desc, List<String> tags, int order) {
        this.id = id; this.title = title; this.type = type; this.subject = subject; this.level = level;
        this.source = source; this.url = url; this.len = len; this.date = date; this.desc = desc; this.tags = List.copyOf(tags);
        this.call = Catalog.dewey(subject) + "." + String.format("%02d", order + 1);
    }
}
