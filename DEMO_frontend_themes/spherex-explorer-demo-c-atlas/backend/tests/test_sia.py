from app.sia import band_for, mjd_to_iso, parse_sia_csv

# Synthetic answer with the columns the app relies on (not a recording).
CSV = """obs_id,t_min,em_min,em_max,energy_bandpassname,access_url,cloud_access
2025W18_1A_0001_1,60800.5,7.5e-7,1.09e-6,SPHEREx-D1,https://irsa.example/a.fits,{"aws":{"bucket_name":"nasa-irsa-spherex"}}
2025W18_1A_0001_4,60800.5,2.42e-6,3.82e-6,SPHEREx-D4,https://irsa.example/b.fits,
broken_row,,7.5e-7,1.09e-6,SPHEREx-D1,,
"""


def test_parse_rows_and_units():
    frames = parse_sia_csv(CSV, "spherex_qr2")
    assert [f.obs_id for f in frames] == ["2025W18_1A_0001_1", "2025W18_1A_0001_4"]
    first = frames[0]
    assert first.release == "QR2" and first.survey == "wide"
    assert first.em_min_um == 0.75 and first.em_max_um == 1.09
    assert first.band == 1 and frames[1].band == 4
    assert first.time_utc == "2025-05-05T12:00:00Z"


def test_band_for_out_of_range():
    assert band_for(6.0, 7.0) is None


def test_mjd_epoch():
    assert mjd_to_iso(0) == "1858-11-17T00:00:00Z"
