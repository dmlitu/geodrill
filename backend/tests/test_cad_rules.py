"""Rule-engine unit tests: token normalization + keyword matching."""
from modules.cad.rules import DetectionRules, keyword_hit, load_rules, normalize_token


def test_normalize_token_case_and_separators():
    assert normalize_token("FORE_KAZIK") == normalize_token("Fore Kazık") == normalize_token("fore-kazik")


def test_normalize_token_turkish_characters():
    # Turkish dotted/dotless I, ş/ç/ğ/ü/ö all collapse to the same ASCII token.
    assert normalize_token("İksa Ankrajı") == normalize_token("iksa ankraji") == "IKSAANKRAJI"
    assert normalize_token("ŞEV") == "SEV"
    assert normalize_token("çakıl") == "CAKIL"
    assert normalize_token("ığüşöç") == "IGUSOC"


def test_normalize_token_empty():
    assert normalize_token("") == ""
    assert normalize_token(None) == ""


def test_keyword_hit_substring_match():
    assert keyword_hit("FORE_KAZIK", ["KAZIK"]) == "KAZIK"
    assert keyword_hit("KAZIKCEPHE", ["KAZIK"]) == "KAZIK"
    assert keyword_hit("ZeminAnkraji", ["ANKRAJ"]) == "ANKRAJ"


def test_keyword_hit_no_match():
    assert keyword_hit("SU KANALİZASYON", ["KAZIK", "ANKRAJ"]) is None


def test_keyword_hit_short_code_requires_exact_match():
    # 'FK' is short enough that it must match the *whole* normalized name,
    # not just appear as a substring of an unrelated word.
    assert keyword_hit("FK", ["FK"]) == "FK"
    assert keyword_hit("FKX99", ["FK"]) is None


def test_load_default_rules_has_expected_shape():
    rules = load_rules()
    assert isinstance(rules, DetectionRules)
    assert "KAZIK" in rules.pile_layer_keywords
    assert "ANKRAJ" in rules.anchor_layer_keywords
    assert rules.confidence["block_layer_geometry_match"] > rules.confidence["block_keyword_match"]
    assert rules.confidence["block_keyword_match"] > rules.confidence["geometry_only"]


def test_confidence_band_boundaries():
    rules = load_rules()
    assert rules.confidence_band(0.99) == "HIGH"
    assert rules.confidence_band(0.70) == "MEDIUM"
    assert rules.confidence_band(0.10) == "LOW"


def test_tolerance_by_unit():
    rules = load_rules()
    assert rules.tolerance_for_unit("mm") > rules.tolerance_for_unit("m")
    assert rules.tolerance_for_unit("does-not-exist") == rules.tolerance_for_unit("unknown")
