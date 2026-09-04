from pipeline.providers.base import BaseProvider
from pipeline.providers.ph_iemop import PhilippinesIEMOPProvider
from pipeline.providers.sg_emc import SingaporeEMCProvider
from pipeline.providers.my_singlebuyer import MalaysiaSingleBuyerProvider

PROVIDERS = {
    "PH": PhilippinesIEMOPProvider,
    "SG": SingaporeEMCProvider,
    "MY": MalaysiaSingleBuyerProvider,
}

__all__ = [
    "BaseProvider",
    "PhilippinesIEMOPProvider",
    "SingaporeEMCProvider",
    "MalaysiaSingleBuyerProvider",
    "PROVIDERS",
]
