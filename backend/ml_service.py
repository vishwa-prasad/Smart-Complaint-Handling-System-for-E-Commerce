"""
ml_service.py
=============
Complaint classification using a trained BiLSTM model
(complaint_classifier.keras + tokenizer.pkl + category_encoder.pkl).

Pipeline:
  1. Preprocess text  →  lowercase, strip noise, remove stopwords, lemmatize
  2. Tokenise         →  Keras Tokenizer (trained, MAX_WORDS=10000)
  3. Pad              →  MAX_LEN=80 tokens
  4. BiLSTM predict   →  softmax probabilities
  5. Decode category  →  LabelEncoder.inverse_transform
  6. Priority         →  rule-based (keyword + per-category floor)
  7. Resolution       →  template per category + priority prefix

Fallback chain when model files are missing:
  BiLSTM  →  rule-based keyword scoring
"""

import os
import re
import pickle
from difflib import get_close_matches
from typing import Tuple

# ── NLTK setup ──────────────────────────────────────────────────────────────
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.stem import WordNetLemmatizer
    from nltk.tokenize import word_tokenize
    for _pkg in ["punkt", "stopwords", "wordnet", "omw-1.4", "punkt_tab"]:
        nltk.download(_pkg, quiet=True)
    _stop_words = set(stopwords.words("english"))
    _lemmatizer = WordNetLemmatizer()
    _NLTK_OK = True
except Exception:
    _NLTK_OK = False

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "models")

_MODEL_PATH   = os.path.join(MODELS_DIR, "complaint_classifier.keras")
_TOK_PATH     = os.path.join(MODELS_DIR, "tokenizer.pkl")
_ENC_PATH     = os.path.join(MODELS_DIR, "category_encoder.pkl")

MAX_LEN = 80   # must match training config

# ── Load BiLSTM model, tokenizer, encoder ────────────────────────────────────
_model    = None
_tokenizer = None
_encoder   = None
_BILSTM_READY = False

try:
    import tensorflow as tf
    import numpy as np
    from tensorflow.keras.preprocessing.sequence import pad_sequences

    if all(os.path.exists(p) for p in [_MODEL_PATH, _TOK_PATH, _ENC_PATH]):
        _model = tf.keras.models.load_model(_MODEL_PATH)
        with open(_TOK_PATH, "rb") as _f:
            _tokenizer = pickle.load(_f)
        with open(_ENC_PATH, "rb") as _f:
            _encoder = pickle.load(_f)
        _BILSTM_READY = True
        print("[ML Service] BiLSTM model loaded OK — categories:", list(_encoder.classes_))
    else:
        print("[ML Service] Model files not found in models/ — using rule-based fallback.")
except ImportError:
    print("[ML Service] TensorFlow not installed — using rule-based fallback.")
except Exception as _e:
    print(f"[ML Service] BiLSTM load error: {_e} — using rule-based fallback.")


# ── Category label mapping ────────────────────────────────────────────────────
# Maps raw labels from the trained encoder to display names used in the system.
_LABEL_DISPLAY = {
    # exact matches from dataset
    "Delivery Issue":         "Delivery Issue",
    "Payment Issue":          "Payment Issue",
    "Product Issue":          "Product Issue",
    # dataset label → display name
    "Account/Login Issue":    "Account Issue",   # actual label in dataset (with slash)
    "Account Login Issue":    "Account Issue",   # safety alias (no slash)
    "Refund Issue":           "Refund Request",
    "Customer Service Issue": "Customer Service",
    # fallback catch-alls (in case model returns display name directly)
    "Account Issue":    "Account Issue",
    "Refund Request":   "Refund Request",
    "Customer Service": "Customer Service",
}


# ── Fuzzy keyword vocabulary (for rule-based fallback) ───────────────────────
_VOCAB = {
    "account","login","password","hack","hacked","unauthorized","locked",
    "phishing","blocked","access","otp","signin",
    "delivery","delivered","deliver","shipment","shipping","tracking",
    "courier","dispatch","parcel","arrived","received",
    "payment","charged","charge","deducted","overcharged","billing",
    "transaction","declined","upi","banking","wallet","debit",
    "refund","double","cashback","reimbursement",
    "damaged","broken","defective","cracked","scratched","faulty",
    "poor","useless","quality",
    "wrong","incorrect","mismatch","missing",
    "rude","unhelpful","support","agent","representative",
    "stock","available","availability","restock",
    "fraud","stolen","scam","urgent","critical","dangerous","safety",
    "not","working","order","product","item",
}

def _fuzzy_correct(text: str) -> str:
    words = text.lower().split()
    corrected = []
    for word in words:
        clean = re.sub(r"[^a-z]", "", word)
        if len(clean) >= 5 and clean not in _VOCAB:
            matches = get_close_matches(clean, _VOCAB, n=1, cutoff=0.82)
            corrected.append(matches[0] if matches else word)
        else:
            corrected.append(word)
    return " ".join(corrected)


def _preprocess(text: str) -> str:
    """Clean text to match the training preprocessing pipeline."""
    text = str(text).lower()
    text = re.sub(r"[^a-z\s]", "", text)
    if _NLTK_OK:
        tokens = word_tokenize(text)
        cleaned = [_lemmatizer.lemmatize(w) for w in tokens if w not in _stop_words]
        return " ".join(cleaned)
    # basic fallback when NLTK is unavailable
    basic_stops = {"the","a","an","is","it","in","of","and","to","i","my","was","not","for","on","with"}
    return " ".join(w for w in text.split() if w not in basic_stops)


# ── Rule-based category classifier (fallback) ────────────────────────────────
_CATEGORY_RULES = {
    "Account Issue": [
        "account","hacked","unauthorized","password","login","access",
        "phishing","locked","suspend","sign in","blocked account",
        "account suspended","account hacked","reset password",
        "two factor","2fa","security breach",
    ],
    "Payment Issue": [
        "payment","payment not processed","payment declined",
        "transaction failed","double charge","double charged",
        "extra charge","amount deducted","deducted from account",
        "upi payment","net banking failed","wallet deducted",
        "billing error","money gone","funds removed",
        "amount missing","money stolen","balance deducted",
    ],
    "Refund Request": [
        "refund","money back","reimburs","cashback","cash back",
        "refund not received","refund pending","refund denied",
        "want refund","need refund","where is my refund",
    ],
    "Product Issue": [
        "damaged","broken","defective","defect","crack","cracked","scratch",
        "not working","stopped working","faulty","poor quality","useless",
        "wrong item","wrong product","incorrect item","different item","mismatch",
        "wrong size","wrong color","wrong colour","got wrong","sent wrong",
        "item missing","incomplete order","not what i ordered",
    ],
    "Delivery Issue": [
        "delivery","deliver","delivered","not delivered","never delivered",
        "shipping","tracking","courier","dispatch","dispatched",
        "late","delay","delayed","not arrived","not received",
        "out for delivery","stuck in transit","lost in transit",
        "where is my package","package not received",
    ],
    "Customer Service": [
        "customer service","support","agent","representative","executive",
        "unhelpful","no reply","not responding","complaint ignored",
        "poor service","worst service","very bad experience",
        "did not help","nobody responded","slow response",
    ],
}

_DELIVERY_OVERRIDE = [
    "not delivered","not yet delivered","still not delivered","never delivered",
    "not arrived","not yet arrived","still not arrived","never arrived",
    "not received","not yet received","still not received","never received",
    "package not here","parcel not here","order not here","still not here",
    "where is my order","where is my package","where is my parcel",
    "havent received","haven't received","waiting for delivery",
    "out for delivery","stuck in transit","lost in transit",
    "delivery not done","delivery failed","delivery pending",
]

_PRODUCT_OVERRIDE = [
    "defective","defect","broken","not working","stopped working","faulty",
    "keeps restarting","keeps crashing","won't turn on","wont turn on",
    "dead on arrival","doa","manufacturing defect","poor quality",
    "damaged","cracked","scratched","scratch","not functional",
    "wrong item","wrong product","wrong color","wrong colour","wrong size",
    "instead of","received wrong","received different","not what i ordered",
]

# ── Account Issue override ───────────────────────────────────────────────────
# Catches login / account access complaints before the model sees them.
_ACCOUNT_OVERRIDE = [
    # Login failures
    "cannot login","can't login","cant login","unable to login",
    "not able to login","login not working","login failed","login error",
    "login issue","login problem","trouble logging in","trouble signing in",
    "cannot sign in","can't sign in","cant sign in","unable to sign in",
    "sign in not working","sign in failed","sign in error","sign in issue",
    "not able to sign in","cannot log in","can't log in","unable to log in",
    "log in failed","log in error","log in not working",
    # Account hacked / compromised
    "account hacked","account compromised","account breached","account stolen",
    "hacked my account","someone hacked","my account was hacked",
    "unauthorized access","unauthorized login","suspicious login",
    "someone logged into my account","someone accessed my account",
    "someone else logged in","unknown login","unknown device logged in",
    "suspicious activity on my account","account under attack",
    # Account locked / blocked / suspended
    "account locked","account blocked","account suspended","account disabled",
    "account banned","account deactivated","account terminated","account restricted",
    "locked out of account","locked out of my account","account has been locked",
    "account has been suspended","account has been disabled","account has been blocked",
    # Password problems
    "forgot password","forget password","forgot my password","forgotten password",
    "reset password","password reset","change password","password not working",
    "wrong password","invalid password","incorrect password","password expired",
    "password reset not working","password reset link","reset link not working",
    "password reset email","not receiving password reset",
    # OTP / 2FA
    "otp not received","otp is not received","otp not being received",
    "otp is not being received","otp has not been received",
    "otp not working","otp is not working","otp expired","otp issue","otp error",
    "otp not coming","otp is not coming","not receiving otp","not received otp",
    "two factor","2fa not working","2fa is not working","2fa isn't working",
    "2fa not received","2fa issue","2fa is not","2 factor not working",
    "two factor not working","two factor is not working","two-factor not working",
    "verification code","verification code not received","verification code not coming",
    "verification code is not","authentication code","auth code not received",
    # Cannot access account
    "cannot access account","can't access account","unable to access account",
    "not able to access account","cannot access my account","can't access my account",
    "account not accessible","account not opening","cannot open account",
    "access to my account","access denied to account",
    # Account details changed without permission
    "account details changed","email changed without","phone number changed",
    "profile hacked","someone changed my password","someone changed my email",
    "account information changed","security settings changed",
]

# ── Customer Service override ────────────────────────────────────────────────
# Catches poor-support complaints before the model sees them.
_CUSTOMER_SERVICE_OVERRIDE = [
    # No reply / no contact
    "no response to email","no response to my email","no reply to email",
    "no reply to my email","not responding to email","not responding to my email",
    "no response for days","no reply for days","no response for several days",
    "no reply for several days","no response from support","no reply from support",
    "support not replying","support not responding","support team not responding",
    "no one called back","nobody called back","no callback","no call back",
    "no one is helping","nobody is helping","not getting any help",
    "no one responded","nobody responded","no one replied","nobody replied",
    # Follow-up failures
    "no follow up","no follow-up","not following up","not followed up",
    "promised callback","promised to call","never called back","said they would call",
    "said they would follow up","still waiting for response","still waiting for reply",
    "been waiting for days","been waiting for weeks","waiting since days",
    # Ticket / complaint ignored
    "support ignored","complaint ignored","ticket ignored","complaint closed",
    "ticket closed without","closed without resolution","closed without solving",
    "marked resolved without","resolved without fixing","issue not resolved by support",
    # Generic / copy-paste responses
    "generic response","same response","copy paste","automated reply",
    "same generic","copy-paste response","bot response","automated message",
    "keep getting the same","keep sending the same","keeps sending same",
    "keeps giving same","sending the same message","same message every time",
    "same reply every time","scripted response","pre-written response",
    # Rude / unhelpful agents
    "rude agent","rude executive","rude support","rude representative",
    "unhelpful agent","unhelpful support","unhelpful executive","unhelpful representative",
    "agent was rude","executive was rude","support was rude","representative was rude",
    "agent was not helpful","agent did not help","agent could not help",
    "executive was not helpful","executive did not help",
    "support was not helpful","support did not help","support could not help",
    "representative was not helpful","representative did not help",
    "did not help me","didnt help me","could not help me","couldnt help me",
    "refused to help","not willing to help","not interested in helping",
    # Poor service general
    "poor customer service","worst customer service","bad customer service",
    "very bad service","terrible service","horrible service","pathetic service",
    "worst support","bad support","terrible support","horrible support",
    "worst experience with support","very bad experience with support",
    "worst experience with customer","very bad experience with customer",
    "no one to help","no support available","support is useless","support is terrible",
    # Being put on hold / transferred
    "put on hold","kept on hold","on hold for hours","on hold for long",
    "transferred multiple times","keep getting transferred","transferred to different",
    "passed around","nobody takes responsibility",
    # Escalation requests
    "escalate to manager","speak to manager","talk to manager","want to talk to manager",
    "want to speak to manager","want to speak to supervisor","speak to supervisor",
    "connect me to manager","transfer to manager","transfer to supervisor",
    "speak with senior","talk to senior agent","senior executive","higher authority",
    "want to escalate","need to escalate","escalating my complaint",
    # Asking same things repeatedly
    "keep asking same","keeps asking same","keep asking the same","keeps asking the same",
    "asking for same documents","asking same question","asking the same question",
    "asking same thing again and again","asking the same thing","asking same questions",
    "asking the same questions","asked me the same","asks the same",
    "repeatedly asking","ask me the same","keep repeating the same",
    "same questions every time","same information again and again",
    "support staff keeps asking","staff keeps asking","agent keeps asking",
    "executive keeps asking","representative keeps asking",
]

def _rule_category(text: str) -> str:
    lower = _fuzzy_correct(text.lower())
    if any(kw in lower for kw in _DELIVERY_OVERRIDE):
        return "Delivery Issue"
    if any(kw in lower for kw in _PRODUCT_OVERRIDE):
        return "Product Issue"
    scores = {
        cat: sum(len(kw.split()) for kw in kws if kw in lower)
        for cat, kws in _CATEGORY_RULES.items()
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Customer Service"


# ── Priority rules ───────────────────────────────────────────────────────────
_PRIORITY_RULES = {
    "High": [
        "hack","hacked","fraud","unauthorized","stolen","security breach",
        "emergency","urgent","critical","money stolen","account compromised",
        "someone else","suspicious login","identity theft",
        "account locked","blocked","access denied",
        "double charge","double charged","duplicate charge",
        "money deducted","amount deducted","bank deducted",
        "payment failed","card declined","transaction failed",
        "money taken","money gone","funds removed",
        "balance gone","amount taken","taken from wallet",
        "stolen from","money stolen","wallet","funds","emptied",
        "not delivered","completely broken","dead on arrival",
        "broken product","defective","faulty","useless",
        "wrong product","lawsuit","escalate","dangerous",
        "safety","refund denied","refund rejected",
    ],
    "Medium": [
        "delay","delayed","tracking","slow response","waiting",
        "poor quality","bad quality","refund pending",
        "wrong size","wrong color","missing item",
    ],
    "Low": [
        "inquiry","question","feedback","minor","small","suggestion",
        "exchange","return","general","when will","in stock",
    ],
}

_CATEGORY_MIN_PRIORITY = {
    "Account Issue":    "High",
    "Product Issue":    "Medium",
    "Payment Issue":    "High",
    "Refund Request":   "Medium",
    "Delivery Issue":   "Medium",
    "Customer Service": "Low",
}

_PRIORITY_ORDER = ["Low", "Medium", "High"]

def _rule_priority(text: str, category: str) -> str:
    lower = _fuzzy_correct(text.lower())
    kp = None
    for prio in ("High", "Medium", "Low"):
        for kw in _PRIORITY_RULES[prio]:
            if kw in lower:
                kp = prio
                break
        if kp:
            break
    floor = _CATEGORY_MIN_PRIORITY.get(category, "Medium")
    if kp is None:
        return floor
    return _PRIORITY_ORDER[max(_PRIORITY_ORDER.index(kp), _PRIORITY_ORDER.index(floor))]


# ── Main classification entry point ─────────────────────────────────────────
def classify_complaint(complaint_text: str) -> Tuple[str, str]:
    """
    Returns (category, priority) for the given complaint text.

    Category comes from the BiLSTM model when available; otherwise falls back
    to rule-based keyword scoring.  Priority is always rule-based.
    """
    corrected = _fuzzy_correct(complaint_text)
    cleaned   = _preprocess(corrected)

    lower = corrected.lower()

    has_cs_signal      = any(kw in lower for kw in _CUSTOMER_SERVICE_OVERRIDE)
    has_account_signal = any(kw in lower for kw in _ACCOUNT_OVERRIDE)

    # ── Hard overrides (order matters) ──────────────────────────────────────
    # 1. Customer Service — checked FIRST so "agent didn't help with my login"
    #    is treated as a service complaint, not an account complaint.
    if has_cs_signal:
        category = "Customer Service"

    # 2. Account Issue — checked BEFORE delivery/product because generic words
    #    like "not working" / "not received" in those lists would otherwise
    #    swallow account phrases like "2FA not working" / "OTP not received".
    elif has_account_signal:
        category = "Account Issue"

    # 3. Delivery  — unambiguous logistics signals
    elif any(kw in lower for kw in _DELIVERY_OVERRIDE):
        category = "Delivery Issue"

    # 4. Product   — unambiguous defect / wrong-item signals
    elif any(kw in lower for kw in _PRODUCT_OVERRIDE):
        category = "Product Issue"

    elif _BILSTM_READY:
        # ── BiLSTM path ────────────────────────────────────────────────────
        import numpy as np
        from tensorflow.keras.preprocessing.sequence import pad_sequences

        seq    = _tokenizer.texts_to_sequences([cleaned])
        padded = pad_sequences(seq, maxlen=MAX_LEN, padding="post", truncating="post")
        probs  = _model.predict(padded, verbose=0)[0]
        idx    = int(np.argmax(probs))
        raw    = _encoder.inverse_transform([idx])[0]
        category = _LABEL_DISPLAY.get(raw, raw)

        # ── Post-model safety net ───────────────────────────────────────────
        # Correct the two categories the model most often confuses.
        if category == "Account Issue" and has_cs_signal:
            category = "Customer Service"
        elif category == "Customer Service" and has_account_signal and not has_cs_signal:
            category = "Account Issue"
    else:
        # ── Rule-based fallback ─────────────────────────────────────────────
        category = _rule_category(corrected)

    priority = _rule_priority(corrected, category)
    return category, priority


# ── Resolution advice ────────────────────────────────────────────────────────
def _extract_subject(text: str) -> str:
    openers = [
        r"^(i (have|am|want|need|would like to|am writing to) (complain|complaint|report|raise|flag) (about|regarding|for)?\s*)",
        r"^(my|the|their|your)\s+",
        r"^(i am complaining about|i want to complain about|i would like to complain about)\s*",
    ]
    cleaned = text.strip().rstrip("?.")
    for pattern in openers:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip()
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned[:60] if len(cleaned) > 60 else cleaned


def get_resolution_advice(category: str, priority: str, complaint_text: str = "") -> str:
    prefix = {
        "High":   "Your complaint has been marked High Priority and escalated to our senior team.",
        "Medium": "Your complaint has been received and is currently under review.",
        "Low":    "Thank you for reaching out to us.",
    }.get(priority, "Thank you for reaching out to us.")

    body = (
        "Our support team has reviewed your complaint and will get back to you "
        "with a resolution as soon as possible. We apologise for any inconvenience caused."
    )

    return f"{prefix} {body}"
