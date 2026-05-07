---
layout: default
title: Research
subtitle: "Technical research, attack techniques, and detection engineering."
description: "Security research articles covering offensive techniques, detection engineering, DFIR, and Active Directory attacks."
permalink: /research/
---

<div class="container">
  <header class="page-header">
    <h1 class="page-title">Research</h1>
    <p class="page-subtitle">Attack techniques, detection logic, and threat research.</p>
  </header>

  <!-- Category filter pills -->
  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:2.5rem">
    <a href="/research/" class="tag-category" style="cursor:pointer">All</a>
    {% assign categories = site.posts | map: "categories" | flatten | uniq | sort %}
    {% for cat in categories %}
    <a href="/research/?cat={{ cat | downcase | replace: ' ', '-' }}" class="tag-category" data-category="{{ cat }}">{{ cat }}</a>
    {% endfor %}
  </div>

  {% if site.posts.size > 0 %}
  <div class="posts-grid">
    {% for post in site.posts %}
      {% include post-card.html post=post %}
    {% endfor %}
  </div>
  {% else %}
  <div class="empty-state">
    <p>No posts yet. Check back soon.</p>
  </div>
  {% endif %}
</div>
