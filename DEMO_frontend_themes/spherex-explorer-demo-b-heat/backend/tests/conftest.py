import sys
from pathlib import Path

# Lets `pytest` run from backend/ without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
