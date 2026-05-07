---
layout: default
title: Writeups
subtitle: "CTF, HackTheBox, and lab writeups."
description: "CTF writeups and HackTheBox solutions from Wizard — offensive security challenges and methodology."
permalink: /writeups/
---

<div class="container">
  <header class="page-header">
    <h1 class="page-title">Writeups</h1>
    <p class="page-subtitle">CTF solutions, HackTheBox walkthroughs, and lab notes.</p>
  </header>

  {% assign writeups = site.posts | where_exp: "p", "p.categories contains 'CTF' or p.categories contains 'HackTheBox' or p.categories contains 'Writeup'" %}

  {% if writeups.size > 0 %}
  <div class="posts-list">
    {% for post in writeups %}
    {% assign words = post.content | number_of_words %}
    {% assign read_time = words | divided_by: 200 | plus: 1 %}
    <a href="{{ post.url | relative_url }}" class="post-card-list">
      <span class="post-card-list-date">{{ post.date | date: "%Y-%m-%d" }}</span>
      <div class="post-card-list-content">
        <div class="post-card-list-title">{{ post.title }}</div>
        {% if post.excerpt %}
        <div class="post-card-list-excerpt">{{ post.excerpt | strip_html | truncate: 100 }}</div>
        {% endif %}
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">
          {% for tag in post.tags limit:4 %}
          <span class="tag-post">{{ tag }}</span>
          {% endfor %}
          {% if post.difficulty %}
          <span class="badge badge-{{ post.difficulty | downcase }}">{{ post.difficulty }}</span>
          {% endif %}
        </div>
      </div>
    </a>
    {% endfor %}
  </div>
  {% else %}
  <!-- If no posts tagged CTF, show all posts -->
  <div class="posts-list">
    {% for post in site.posts %}
    <a href="{{ post.url | relative_url }}" class="post-card-list">
      <span class="post-card-list-date">{{ post.date | date: "%Y-%m-%d" }}</span>
      <div class="post-card-list-content">
        <div class="post-card-list-title">{{ post.title }}</div>
        {% if post.excerpt %}
        <div class="post-card-list-excerpt">{{ post.excerpt | strip_html | truncate: 100 }}</div>
        {% endif %}
      </div>
    </a>
    {% endfor %}
  </div>
  {% endif %}
</div>
