"""Deterministic canonicalisation. Its ONLY job is to fold evasion tricks
(homoglyphs, zero-width chars, full-width forms, spacing) into a comparable
form before regex/classifier see the text — it never decides topic or intent.
"""
import re
import unicodedata

# Zero-width / invisible / soft-hyphen characters used to split banned words.
_ZERO_WIDTH = dict.fromkeys(
    map(ord, "​‌‍⁠﻿­᠎"), None
)

# Minimal confusable → ASCII map (Cyrillic / Greek lookalikes). Extend as needed;
# a fuller solution would use the Unicode "confusables.txt" data set.
_CONFUSABLES = str.maketrans({
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
    "і": "i", "ѕ": "s", "ԁ": "d", "һ": "h", "ո": "n",           # Cyrillic/Armenian
    "α": "a", "ο": "o", "ρ": "p", "ν": "v", "ι": "i", "ϲ": "c",  # Greek
})

# Long base64/hex-ish blobs are a classic "decode this and follow it" smuggling
# vector. We don't auto-reject (false positives), we flag → force the classifier.
_ENCODED_BLOB = re.compile(r"[A-Za-z0-9+/=]{40,}|(?:%[0-9A-Fa-f]{2}){8,}")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)   # full-width / compatibility → base
    text = text.translate(_ZERO_WIDTH)           # strip invisibles
    text = text.translate(_CONFUSABLES)          # homoglyph → ASCII
    text = re.sub(r"[\-_.]{2,}", " ", text)      # s-y-s-t-e-m → collapse separators
    text = re.sub(r"\s+", " ", text).strip()     # normalise whitespace
    return text


def looks_encoded(text: str) -> bool:
    """True if the message hides a long encoded blob → treat as suspicious."""
    return bool(_ENCODED_BLOB.search(text))
