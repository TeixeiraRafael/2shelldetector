// All the jokes live here so they are easy to add to.
// {x} becomes "<term>2shell", {t} becomes the bare term.

window.TWOSHELL_MESSAGES = [
  'Good news, {x} is not a known CVE (yet). Try again in a few minutes, who knows?',
  'No {x} found. Your {t} is safe. For now. Refresh responsibly.',
  'Zero results for {x}. Somewhere, a security researcher just opened a new tab.',
  '{x} does not exist yet. Please do not take this as a challenge.',
  'We checked. No {x}. Enjoy this brief moment of peace before the next bug with a logo drops.',
  '{x}: not a CVE, not a logo, not a domain. Give it until Friday at 5pm.',
  'All clear! {x} is still just a really good band name.',
  'No {x} detected. The vulnerability marketing team has been notified.',
  'Nothing yet. {x}.com might still be available, if you want to get ahead of it.',
  '{x} is not a thing. Statistically, that makes it overdue.',
  'Good news: no {x}. Bad news: we only checked a few seconds ago.',
  'Your {t} is currently 2shell-free. Results valid for approximately one news cycle.',
  'No {x} found. Sleep well tonight. Maybe keep your phone on, though.',
  'We searched the internet. No {x}. The internet is large and full of surprises, so check back soon.',
  '{x} has not been discovered. Or it has, and it is under embargo. Either way, nothing to see here 👀',
  'Negative on {x}. Your CISO may now unclench.',
  'No {x}. Someone is definitely fuzzing it right now, though.',
  'Clean bill of health for {t}. No 2shell, no logo, no sad SOC analysts. Yet.',
  'No {x} today. Try again after the next conference talk.',
  '{x} not found. This message will self-destruct when the PoC hits GitHub.',
  'Phew. No {x}. Go touch grass before someone finds one.',
  'Good news, {x} is not a known CVE (yet). Patch Tuesday has not spoken.',
  'No {x}. The threat intel feeds are quiet. Too quiet.',
  '{x} is not real. Unlike your backlog of unpatched servers.',
  'Breaking: local {t} survives another day without a 2shell. More at eleven.',
  'Good news, {x} is not a known CVE (yet). Hit refresh in five minutes and live dangerously.',
];

// Little loading quips that rotate while the search runs.
window.TWOSHELL_LOADING = [
  'Asking Hacker News if it has panicked yet...',
  'Checking GitHub for suspiciously named PoCs...',
  'Reading Wikipedia like it is a threat feed...',
  'Counting vendor blog posts with logos...',
  'Refreshing the CVE feed nervously...',
  'Consulting the ancient scrolls of the NVD...',
];

// Easter egg: famous cousins shown when there is no 2shell for a term.
window.TWOSHELL_COUSINS = {
  log: { name: 'Log4Shell', cve: 'CVE-2021-44228' },
  log4j: { name: 'Log4Shell', cve: 'CVE-2021-44228' },
  spring: { name: 'Spring4Shell', cve: 'CVE-2022-22965' },
  text: { name: 'Text4Shell', cve: 'CVE-2022-42889' },
  proxy: { name: 'ProxyShell', cve: 'CVE-2021-34473' },
  exchange: { name: 'ProxyShell', cve: 'CVE-2021-34473' },
  bash: { name: 'Shellshock', cve: 'CVE-2014-6271' },
  shell: { name: 'Shellshock', cve: 'CVE-2014-6271' },
  openssl: { name: 'Heartbleed', cve: 'CVE-2014-0160' },
  heart: { name: 'Heartbleed', cve: 'CVE-2014-0160' },
  word: { name: 'Follina', cve: 'CVE-2022-30190' },
  office: { name: 'Follina', cve: 'CVE-2022-30190' },
  print: { name: 'PrintNightmare', cve: 'CVE-2021-34527' },
  printer: { name: 'PrintNightmare', cve: 'CVE-2021-34527' },
  xz: { name: 'the XZ Utils backdoor', cve: 'CVE-2024-3094' },
  citrix: { name: 'Citrix Bleed', cve: 'CVE-2023-4966' },
  ssh: { name: 'regreSSHion', cve: 'CVE-2024-6387' },
  openssh: { name: 'regreSSHion', cve: 'CVE-2024-6387' },
  netlogon: { name: 'Zerologon', cve: 'CVE-2020-1472' },
  smb: { name: 'EternalBlue', cve: 'CVE-2017-0144' },
  linux: { name: 'Dirty COW', cve: 'CVE-2016-5195' },
  cow: { name: 'Dirty COW', cve: 'CVE-2016-5195' },
};
