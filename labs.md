---
layout: default
title: Labs
subtitle: "Personal lab builds, environments, and experiments."
description: "Personal security labs, home lab setups, and experimental environments."
permalink: /labs/
---

<div class="container">
  <header class="page-header">
    <h1 class="page-title">Labs</h1>
    <p class="page-subtitle">Personal lab environments, tooling, and experiments.</p>
  </header>

  {% if site.labs.size > 0 %}
  <div class="posts-grid">
    {% for lab in site.labs %}
    <a href="{{ lab.url | relative_url }}" class="lab-card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
        <div class="lab-title">{{ lab.title }}</div>
        {% if lab.status %}
        <span class="badge badge-{{ lab.status | downcase }}">{{ lab.status }}</span>
        {% endif %}
      </div>
      {% if lab.description %}
      <div class="lab-description">{{ lab.description }}</div>
      {% endif %}
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
        {% for tag in lab.tags limit:3 %}
        <span class="tag-post">{{ tag }}</span>
        {% endfor %}
      </div>
    </a>
    {% endfor %}
  </div>
  {% else %}
  <div class="empty-state">
    <p>No labs published yet.</p>
  </div>
  {% endif %}
</div>
