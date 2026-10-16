import pytest

from core.risk_assessment import parse_risk_assessment


VALID_RISKS = (
    '{"risks":['
    '{"title":"API outage","description":"The external API could become unavailable.",'
    '"likelihood":"medium","impact":"high",'
    '"mitigation":"Use timeouts and provide a local fallback."},'
    '{"title":"Scope creep","description":"Optional features could displace required work.",'
    '"likelihood":"high","impact":"medium",'
    '"mitigation":"Freeze an MVP and defer optional work."},'
    '{"title":"Late integration","description":"Separate modules may not work together near delivery.",'
    '"likelihood":"low","impact":"high",'
    '"mitigation":"Integrate a small vertical slice early in development."}'
    ']}'
)


def test_parse_risk_assessment_accepts_valid_json_and_code_fences():
    parsed = parse_risk_assessment(f"```json\n{VALID_RISKS}\n```")
    assert len(parsed["risks"]) == 3
    assert parsed["risks"][0]["likelihood"] == "medium"


@pytest.mark.parametrize(
    "raw",
    [
        "not json",
        '{"risks":[]}',
        VALID_RISKS.replace('"likelihood":"medium"', '"likelihood":"certain"'),
        VALID_RISKS.replace('"mitigation":"Use timeouts and provide a local fallback."}', '"mitigation":"short"}'),
    ],
)
def test_parse_risk_assessment_rejects_invalid_or_incomplete_output(raw: str):
    with pytest.raises(ValueError, match="invalid structured assessment"):
        parse_risk_assessment(raw)
