"""Which flagged pixels to exclude.

The default mask is the set of flags the IRSA SPHEREx Mosaic Tool sets to NaN (Explanatory
Supplement v2.0, §3.4.3). OVERFLOW, OUTLIER and SOURCE are informational there and here: SOURCE
alone marks 40–70 % of all pixels, because it means "a catalogued source falls here", not "bad".
"""

DEFAULT_MASKED = (
    "TRANSIENT",
    "SUR_ERROR",
    "NONFUNC",
    "DICHROIC",
    "MISSING_DATA",
    "HOT",
    "COLD",
    "PHANMISS",
    "NONLINEAR",
    "PERSIST",
    "CROSSTALK",
    "GHOST",
    "GHOST_FPA",
    "GHOST_EXT",
    "STREAK",
    "BLOOM",
    "SNOWBALL",
    "HALO",
    "SATELLITE_HALO",
)

# Bit numbers from ES v2.0 Table 16, used only when a file's FLAGS header does not define a name.
DOCUMENTED_BITS = {
    "TRANSIENT": 0,
    "OVERFLOW": 1,
    "SUR_ERROR": 2,
    "NONFUNC": 6,
    "DICHROIC": 7,
    "MISSING_DATA": 9,
    "HOT": 10,
    "COLD": 11,
    "FULLSAMPLE": 12,
    "PHANMISS": 14,
    "NONLINEAR": 15,
    "PERSIST": 17,
    "OUTLIER": 19,
    "CROSSTALK": 20,
    "SOURCE": 21,
    "GHOST": 22,
    "GHOST_FPA": 23,
    "GHOST_EXT": 24,
    "STREAK": 25,
    "BLOOM": 26,
    "SNOWBALL": 27,
    "HALO": 28,
    "SATELLITE_HALO": 29,
}


def bit_table(from_header: dict[str, int]) -> dict[str, int]:
    """The file's own definitions, completed from the documented table."""
    table = dict(DOCUMENTED_BITS)
    table.update(from_header)
    return table


def mask_value(bits: dict[str, int], names: tuple[str, ...] = DEFAULT_MASKED) -> int:
    value = 0
    for name in names:
        if name in bits:
            value |= 1 << bits[name]
    return value


def names_set(value: int, bits: dict[str, int]) -> list[str]:
    return sorted(name for name, bit in bits.items() if value >> bit & 1)
