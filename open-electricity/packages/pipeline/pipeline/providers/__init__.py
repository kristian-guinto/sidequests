from pipeline.providers.base import BaseProvider
from pipeline.providers.ph_iemop import PhilippinesIEMOPProvider
from pipeline.providers.sg_emc import SingaporeEMCProvider
from pipeline.providers.my_singlebuyer import MalaysiaSingleBuyerProvider
from pipeline.providers.th_egat import ThailandEGATProvider

PROVIDERS = {
    "PH": PhilippinesIEMOPProvider,
    "SG": SingaporeEMCProvider,
    "MY": MalaysiaSingleBuyerProvider,
    "TH": ThailandEGATProvider,
}

__all__ = [
    "BaseProvider",
    "PhilippinesIEMOPProvider",
    "SingaporeEMCProvider",
    "MalaysiaSingleBuyerProvider",
    "ThailandEGATProvider",
    "PROVIDERS",
]
