#!/usr/bin/env python3
"""Real-time pulse: dated, current signals for FixTwin decisions.

Usage: python3 ops/pulse.py "query one" "query two" ... [--days 7] [--region IN|US|GB] [--hn]
Sources that work from the cloud session (checked 21 Nov 2026):
  - Google News RSS (news, any language/region), with a when:Nd filter
  - Hacker News (Algolia API) for tech and small-business tool discussions
Reddit and X block direct reading here; search them with the WebSearch tool
(e.g. 'site:reddit.com r/doggrooming booking', 'site:x.com MoeGo') and log dates.
Every item is printed with its date so decisions can cite it.
"""
import json, re, sys, urllib.parse, urllib.request
from html import unescape

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 FixTwinPulse/1.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")

def google_news(q, days, region):
    hl, gl, ceid = {"IN": ("en-IN", "IN", "IN:en"), "US": ("en-US", "US", "US:en"), "GB": ("en-GB", "GB", "GB:en")}[region]
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": f"{q} when:{days}d", "hl": hl, "gl": gl, "ceid": ceid})
    out = []
    for title, link, date in re.findall(r"<item><title>(.*?)</title><link>(.*?)</link>.*?<pubDate>(.*?)</pubDate>", get(url)):
        out.append((date[:16], unescape(title), link))
    return out

def hacker_news(q):
    url = "https://hn.algolia.com/api/v1/search_by_date?" + urllib.parse.urlencode({"query": q, "tags": "story"})
    d = json.loads(get(url))
    return [(h["created_at"][:10], h.get("title") or "", h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}") for h in d.get("hits", [])[:5]]

if __name__ == "__main__":
    args = sys.argv[1:]
    days = 7
    if "--days" in args:
        i = args.index("--days"); days = int(args[i + 1]); del args[i:i + 2]
    use_hn = "--hn" in args
    if use_hn: args.remove("--hn")
    region = "IN"
    if "--region" in args:
        i = args.index("--region"); region = args[i + 1]; del args[i:i + 2]
    for q in args:
        print(f"\n## {q}  (last {days} days, {region})")
        try:
            for d, t, l in google_news(q, days, region)[:8]:
                print(f"- [{d}] {t} | {l}")
        except Exception as e:
            print(f"- news error: {e}")
        if not use_hn:
            continue
        try:
            for d, t, l in hacker_news(q):
                print(f"- [HN {d}] {t} | {l}")
        except Exception as e:
            print(f"- HN error: {e}")
