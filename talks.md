---
layout: default
title: Talks
subtitle: "Conference presentations and public research."
description: "Security conference talks and presentations by Wizard."
permalink: /talks/
---

<div class="container">
  <header class="page-header">
    <h1 class="page-title">Talks</h1>
    <p class="page-subtitle">Conference presentations and public research.</p>
  </header>

  {% if site.talks.size > 0 %}
  <div class="posts-list">
    {% assign sorted_talks = site.talks | sort: "date" | reverse %}
    {% for talk in sorted_talks %}
    <div class="talk-card">
      <div class="talk-date-block">
        <span class="talk-date-month">{{ talk.date | date: "%b" }}</span>
        <span class="talk-date-year">{{ talk.date | date: "%Y" }}</span>
      </div>
      <div>
        <div class="talk-title">{{ talk.title }}</div>
        <div class="talk-event">{{ talk.event }}{% if talk.location %} &middot; {{ talk.location }}{% endif %}</div>
        <div class="talk-badges">
          {% if talk.slides_url %}<a href="{{ talk.slides_url }}" class="tag-category" target="_blank" rel="noopener">Slides</a>{% endif %}
          {% if talk.video_url %}<a href="{{ talk.video_url }}" class="tag-category" target="_blank" rel="noopener">Video</a>{% endif %}
          {% if talk.blog_url %}<a href="{{ talk.blog_url | relative_url }}" class="tag-category">Blog post</a>{% endif %}
        </div>
      </div>
    </div>
    {% endfor %}
  </div>
  {% else %}
  <div class="empty-state">
    <p>No talks published yet.</p>
  </div>
  {% endif %}
</div>
