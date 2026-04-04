"""
Gemini Code Review 스크립트
PR diff를 Gemini API로 리뷰하고 결과를 PR 코멘트로 게시
"""
import os
import requests

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GH_TOKEN = os.environ["GH_TOKEN"]
PR_NUMBER = os.environ["PR_NUMBER"]
REPO = os.environ["REPO"]
GH_API = "https://api.github.com"


def get_pr_diff():
    r = requests.get(
        f"{GH_API}/repos/{REPO}/pulls/{PR_NUMBER}",
        headers={"Authorization": f"token {GH_TOKEN}", "Accept": "application/vnd.github.v3.diff"},
    )
    r.raise_for_status()
    return r.text[:30000]


def review_with_gemini(diff_text):
    prompt = f"""다음 PR diff를 코드 리뷰해주세요. 한국어로 답변.

## 리뷰 항목:
1. 🐛 버그 가능성
2. ⚠️ 개선 제안
3. ✅ 좋은 점
4. 📋 종합 의견

---
```diff
{diff_text}
```"""
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}",
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 3000},
        },
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def post_comment(body):
    r = requests.post(
        f"{GH_API}/repos/{REPO}/issues/{PR_NUMBER}/comments",
        headers={"Authorization": f"token {GH_TOKEN}", "Accept": "application/vnd.github.v3+json"},
        json={"body": body},
    )
    r.raise_for_status()


if __name__ == "__main__":
    print(f"Reviewing PR #{PR_NUMBER} in {REPO}")
    diff = get_pr_diff()
    if not diff.strip():
        print("No diff found")
        exit(0)
    print(f"Diff length: {len(diff)} chars")
    review = review_with_gemini(diff)
    comment_body = f"## 🤖 Gemini Code Review\n\n{review}\n\n---\n*Powered by Google Gemini*"
    post_comment(comment_body)
    print("Review posted!")
