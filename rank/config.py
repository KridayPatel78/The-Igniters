"""Scoring constants. Values come from the challenge brief (AGENTS.md); tune here, not in score.py.
The rubric in plain English: rank/README.md.
"""

# key -> scenario. Pressure is shown as a note only (not scored).
SCENARIOS = {
    "iss_cabin": {"label": "ISS cabin", "o2_percent": 21, "pressure_psi": 14.7, "ventilation": "ventilated"},
    "moon_base": {"label": "Moon base / pressurized rover", "o2_percent": 30, "pressure_psi": 10.2,
                  "ventilation": "ventilated"},
    "mars_habitat": {"label": "Mars habitat (assumed same as Moon base)", "o2_percent": 30, "pressure_psi": 10.2,
                     "ventilation": "ventilated"},
    "spacesuit": {"label": "Spacesuit", "o2_percent": 100, "pressure_psi": 4.3, "ventilation": "quiescent"},
}
PARTIAL_GRAVITY_SCENARIOS = {"moon_base", "mars_habitat"}

FOCUSES = ("all", "prevention", "detection", "suppression")
VENTILATIONS = ("ventilated", "quiescent")

# A. Oxygen closeness (0-35): full points inside the range, linear to 0 at O2_WINDOW points away.
O2_MAX = 35
O2_WINDOW = 30

# B. Flow regime match (0-15)
FLOW_MAX = 15
FLOW_MATCH, FLOW_MISMATCH, FLOW_UNKNOWN = 15, 5, 7.5

# C. Material relevance (0-20)
MATERIAL_MAX = 20
PHASE_BASE = {"solid": 14, "mixed": 10, "gas": 6, "liquid_droplet": 4}  # placeholder/unknown -> 0
PHASE_LABEL = {"solid": "Solid fuels", "mixed": "Mixed solid + gas fuels", "gas": "Gaseous fuels",
               "liquid_droplet": "Liquid droplet fuels"}
HABITAT_MATERIAL_BONUS = 6
HABITAT_MATERIALS = ("fabric", "cotton", "Nomex", "PMMA", "acrylic", "plastic", "polymer", "Ultem", "silicone",
                     "foam", "wire", "insulation", "SIBAL", "Delrin", "polyethylene", "Kapton")

# D. Pillar coverage (0-20)
PILLAR_MAX = 20
PILLARS_ALL_FOCUS = {0: 0, 1: 14, 2: 17, 3: 20}  # focus="all": points by number of pillars covered
PILLAR_FOCUS_HIT, PILLAR_FOCUS_OTHER = 20, 6      # focus=<pillar>: covers it / covers another only

# E. Data richness (0-10)
RICHNESS_MAX = 10
RICHNESS_TABLE = 5
RICHNESS_PER_MEASUREMENT, RICHNESS_MEASUREMENT_CAP = 1, 5
