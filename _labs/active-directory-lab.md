---
title: "Active Directory Attack Lab"
description: "A multi-forest Active Directory lab environment for practicing offensive and defensive techniques."
date: 2026-02-01
tags: [Active Directory, Lab, Windows Server, VMware, Attack Simulation]
status: Active
toc: true
---

A personal Active Directory lab for practicing attacks, building detections, and testing tooling.

## Architecture

```
Forest: corp.local
├── DC01.corp.local (Windows Server 2022 — PDC)
├── DC02.corp.local (Windows Server 2019 — RODC)
├── WKSTN01.corp.local (Windows 11 — workstation)
├── WKSTN02.corp.local (Windows 10 — workstation)
├── SRV01.corp.local (Windows Server 2022 — MSSQL)
└── SIEM.corp.local (Ubuntu 22.04 — Elastic Stack)

Trust: corp.local ←→ partner.local (bidirectional)
```

## Lab Scenarios

- LLMNR/NBNS poisoning → credential capture
- Kerberoasting and AS-REP roasting
- Pass-the-Hash / Pass-the-Ticket
- BloodHound path exploitation
- ADCS ESC1-ESC8
- DCSync and domain persistence

## Defensive Stack

- Sysmon (SwiftOnSecurity ruleset)
- Windows Event Forwarding → Elastic
- Sigma rules deployed via elastic-agent
- Suricata on network tap
