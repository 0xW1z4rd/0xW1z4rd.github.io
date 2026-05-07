---
title: "Detection Engineering: Writing Effective Sigma Rules"
date: 2026-04-15
categories: [Detection, Research]
tags: [Sigma, Detection Engineering, SIEM, Threat Hunting, Splunk, Elastic]
author: Wizard
toc: true
comments: true
description: "A practical guide to writing production-quality Sigma rules — from understanding the format to tuning and deploying detections in Splunk and Elastic."
---

Sigma is a generic signature format for SIEM systems. A well-written Sigma rule can be deployed across Splunk, Elastic, Microsoft Sentinel, and dozens of other platforms without rewriting the logic. This post covers the craft of writing Sigma rules that actually fire in production — with low false positive rates and high detection fidelity.

## Why Sigma?

Before Sigma, every detection engineer wrote platform-specific queries. A Splunk SPL rule had to be manually rewritten as KQL for Sentinel, then again as EQL for Elastic. This created:

- **Detection debt** — rules written for one platform never got ported
- **Knowledge silos** — the Splunk team couldn't read the Elastic rules
- **Fragmented threat libraries** — no shared, community-maintained detections

Sigma solves this with a single YAML format that compiles to any backend.

## Sigma Rule Structure

A complete Sigma rule has these sections:

```yaml
title: Suspicious PowerShell Encoded Command
id: 7f1d1b8a-4a2c-4b89-9c3d-2e5f6a7b8c9d
status: test
description: Detects PowerShell execution with encoded commands, commonly used for obfuscation
references:
    - https://attack.mitre.org/techniques/T1059/001/
author: Wizard
date: 2026/04/15
modified: 2026/04/15

logsource:
    category: process_creation
    product: windows

detection:
    selection:
        Image|endswith:
            - '\powershell.exe'
            - '\pwsh.exe'
        CommandLine|contains:
            - ' -e '
            - ' -en '
            - ' -enc '
            - ' -encodedcommand '
            - ' -encodedCommand '
    condition: selection

falsepositives:
    - Legitimate scripts using encoded commands
    - Software deployment tools (SCCM, Intune)

level: medium
tags:
    - attack.execution
    - attack.t1059.001
```

### Key Fields Explained

**`id`** — A stable UUID that uniquely identifies this rule. Never change it; create a new rule if the logic changes significantly.

**`status`** — The maturity of the rule:
- `stable` — tested, production-ready
- `test` — needs tuning
- `experimental` — prototype, likely high FP rate
- `deprecated` — retired

**`logsource`** — Defines the log type. This is what Sigma uses to route the rule to the right index or data stream. Key categories:
- `process_creation` — Sysmon Event ID 1, Windows Security 4688
- `network_connection` — Sysmon Event ID 3
- `dns_query` — Sysmon Event ID 22
- `file_event` — Sysmon Event ID 11

**`detection`** — The logic. This is where the rule lives.

## Detection Logic

### Field Modifiers

Sigma uses modifiers to define how field values are matched:

```yaml
detection:
    selection:
        CommandLine|contains: 'mimikatz'           # substring match
        CommandLine|contains|all:                   # all must match
            - 'sekurlsa'
            - 'logonpasswords'
        Image|endswith: '\lsass.exe'                # suffix match
        Image|startswith: 'C:\Windows\'             # prefix match
        TargetImage|re: '.*\\(powershell|cmd)\.exe' # regex
        EventID|in:                                 # one of these values
            - 4624
            - 4625
            - 4648
```

### Conditions

The `condition` field supports boolean logic:

```yaml
# Both selections must match
condition: selection_process and selection_network

# Either selection matches
condition: selection_a or selection_b

# selection matches but filter does not
condition: selection and not filter

# Count-based condition (rare event aggregation)
condition: selection | count() > 5
```

### Timeframe (Aggregation rules)

```yaml
detection:
    selection:
        EventID: 4625
        LogonType: 3
    condition: selection | count() > 10
timeframe: 5m
```

This fires when more than 10 failed network logons occur within a 5-minute window — a classic brute force detection.

## Writing High-Quality Rules

### Principle 1 — Anchor to Specific Behavior

Weak detection:
```yaml
# Too broad — catches nearly everything
selection:
    CommandLine|contains: 'powershell'
```

Better detection:
```yaml
# Anchored to a specific technique: PowerShell download cradle
selection:
    Image|endswith: '\powershell.exe'
    CommandLine|contains:
        - 'IEX'
        - 'Invoke-Expression'
    CommandLine|contains:
        - 'DownloadString'
        - 'WebClient'
        - 'Net.WebClient'
```

### Principle 2 — Exclude Known-Good Baselines

Every detection needs a `filter` section that excludes legitimate triggers:

```yaml
detection:
    selection:
        Image|endswith: '\wscript.exe'
        CommandLine|contains: '.vbs'
    filter_legitimate:
        CommandLine|contains:
            - 'C:\Windows\System32\'
            - 'C:\Program Files\Microsoft Office\'
    condition: selection and not filter_legitimate
```

### Principle 3 — Use Parent Process Context

Process injection and LOLBins often abuse unexpected parent-child relationships:

```yaml
title: Suspicious Child Process of Office Applications
detection:
    selection:
        ParentImage|endswith:
            - '\winword.exe'
            - '\excel.exe'
            - '\outlook.exe'
            - '\powerpnt.exe'
        Image|endswith:
            - '\cmd.exe'
            - '\powershell.exe'
            - '\wscript.exe'
            - '\mshta.exe'
            - '\regsvr32.exe'
    condition: selection
level: high
tags:
    - attack.execution
    - attack.t1566.001
```

## Compiling Sigma to Platform Queries

### Using sigma-cli

```bash
# Install sigma-cli
pip install sigma-cli

# List available backends
sigma list backends

# Compile to Splunk SPL
sigma convert -t splunk -p splunk_windows rule.yml

# Compile to Elastic EQL
sigma convert -t elasticsearch -p ecs_windows rule.yml -f eql

# Compile to Microsoft Sentinel KQL
sigma convert -t microsoft365defender rule.yml
```

### Splunk Output

```spl
index=windows (Image="*\\powershell.exe" OR Image="*\\pwsh.exe")
(CommandLine=" -e " OR CommandLine=" -en " OR CommandLine=" -enc "
 OR CommandLine=" -encodedcommand " OR CommandLine=" -encodedCommand ")
| table _time, host, User, Image, CommandLine, ParentImage
```

### Elastic EQL Output

```eql
process where
  process.name in ("powershell.exe", "pwsh.exe") and
  process.command_line like~ "* -e *" or
  process.command_line like~ "* -enc *" or
  process.command_line like~ "* -encodedcommand *"
```

## Testing and Tuning

### Local Testing with evtx-sigma

```bash
# Test rule against captured event logs
python3 sigmac -t humio -r rules/proc_creation_win_powershell_encoded.yml

# Run against EVTX file (requires hayabusa or chainsaw)
hayabusa csv-timeline -f system.evtx -r sigma/rules/
```

### Measuring False Positive Rate

Before deploying, run the compiled query against 30 days of historical data:

1. Count unique hosts triggering the rule
2. Sample 10% and manually verify
3. Identify common false positive patterns
4. Add to `filter` section and re-test

<div class="callout callout-note">
<strong>Note</strong>
A rule that fires on 500 events/day with a 95% FP rate generates 475 false positives daily — completely unusable. Aim for under 10 FPs per day before deploying to production.
</div>

## Rule Library Organization

Structure your rule library with clear versioning and ownership:

```
sigma/
├── windows/
│   ├── process_creation/
│   │   ├── proc_creation_win_powershell_encoded.yml
│   │   ├── proc_creation_win_mimikatz.yml
│   │   └── proc_creation_win_lolbas_*.yml
│   ├── network_connection/
│   └── registry_event/
├── linux/
├── cloud/
│   ├── aws/
│   └── azure/
└── network/
    ├── proxy/
    └── firewall/
```

## Summary

Writing effective Sigma rules requires:

1. **Understanding the attack technique** — know exactly what you're trying to detect
2. **Using specific field modifiers** — avoid broad string matching
3. **Filtering known-good baseline** — keep FP rate manageable
4. **Testing against historical data** before production deployment
5. **Maintaining rule maturity status** — don't ship experimental rules to SOC tier 1

The Sigma ecosystem is mature enough that a well-written rule library is a strategic asset — it survives SIEM migrations and vendor changes intact.
