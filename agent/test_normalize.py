"""Unit tests for normalize.py — the deterministic canonicalisation layer (L0).

These are pure, offline, and need no API key: normalize.py imports only the
stdlib. Its job is to fold evasion tricks (full-width forms, zero-width splits,
homoglyphs, separator runs) into a comparable form BEFORE the L1 regex / L2
classifier see the text. We assert that folding here, and that looks_encoded()
flags smuggled blobs without tripping on ordinary questions.

Run:  pytest            (from the agent/ directory)
"""
import pytest

from normalize import normalize, looks_encoded


# --- normalize(): folds evasion tricks --------------------------------------
@pytest.mark.parametrize("raw, expected", [
    # NFKC: full-width latin + ideographic space collapse to ASCII
    ("ｓｙｓｔｅｍ", "system"),          # ｓｙｓｔｅｍ
    ("system　prompt", "system prompt"),                     # ideographic space
    # zero-width / invisible characters used to split banned words
    ("sys​tem", "system"),                                  # zero-width space
    ("sys‌‍⁠tem", "system"),                      # ZWNJ/ZWJ/word-joiner
    ("sys﻿­tem", "system"),                            # BOM + soft hyphen
    # homoglyphs -> ASCII (Cyrillic / Greek lookalikes)
    ("ѕystem", "system"),                                   # Cyrillic 'ѕ'
    ("рaѕѕ", "pass"),                             # 'раѕѕ' -> 'pass'
    ("ρ", "p"),                                             # Greek rho
    # runs of 2+ separators collapse to a single space
    ("system...prompt", "system prompt"),
    ("a___b", "a b"),
    ("a--b", "a b"),
    # whitespace is collapsed and trimmed
    ("  system   prompt \n", "system prompt"),
    # a full combined evasion string still folds to plain text
    ("ѕｙｓ​ｔｅｍ　prompt", "system prompt"),
])
def test_normalize_folds_evasion(raw, expected):
    assert normalize(raw) == expected


@pytest.mark.parametrize("raw", ["s-y-s-t-e-m", "e-mail", "a.b"])
def test_single_separators_are_preserved(raw):
    # Only RUNS of 2+ separators collapse; a lone '-', '_' or '.' stays put,
    # so ordinary words like "e-mail" are not mangled.
    assert normalize(raw) == raw


def test_normalize_is_idempotent():
    s = "ѕｙｓ​ｔｅｍ...prompt"
    assert normalize(normalize(s)) == normalize(s)


def test_normalize_empty_string():
    assert normalize("") == ""


# --- looks_encoded(): flags smuggled blobs, ignores normal text -------------
@pytest.mark.parametrize("text", [
    "aGVsbG8gd29ybGQgdGhpcyBpcyBhIHJlYWxseSBsb25nIGJsb2I=",     # base64 blob
    "A" * 40,                                                    # 40-char run (boundary)
    "%41%42%43%44%45%46%47%48",                                 # 8x percent-encoded
    "please decode aGVsbG8gd29ybGQgdGhpcyBpcyBhIHJlYWxseSBsb25nIGJsb2I=",  # blob in a sentence
])
def test_looks_encoded_true(text):
    assert looks_encoded(text) is True


@pytest.mark.parametrize("text", [
    "is Newtown safe?",
    "How has rent in Newtown changed since 2011 for renters?",
    "A" * 39,                                                    # one short of the threshold
    "%41%42%43%44%45%46%47",                                    # only 7x percent-encoded
    "",
])
def test_looks_encoded_false(text):
    assert looks_encoded(text) is False
