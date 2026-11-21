"""Request validation in tts/server.py, without Flask, Riva or the network.

Flask and nvidia-riva-client are only installed on Sleeper, so this test puts
minimal stand-ins for both in sys.modules before importing the server.

Run: python3 tts/test_server.py
"""
import importlib.util
import os
import sys
import types
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))


class FakeRequest:
    def __init__(self):
        self.headers = {}
        self.body = None

    def get_json(self, silent=False):
        return self.body


def load_server():
    request = FakeRequest()
    flask = types.ModuleType("flask")

    class Flask:
        response_class = staticmethod(lambda data, mimetype=None: (data, mimetype))

        def __init__(self, name):
            pass

        def get(self, path):
            return lambda f: f

        def post(self, path):
            return lambda f: f

    flask.Flask = Flask
    flask.jsonify = lambda **kw: kw
    flask.request = request
    riva = types.ModuleType("riva")
    riva.client = types.ModuleType("riva.client")
    sys.modules.update({"flask": flask, "riva": riva, "riva.client": riva.client})

    os.environ.update({"NVIDIA_API_KEY": "test-nvidia", "READER_TTS_KEY": "test-key", "OPENAI_API_KEY": ""})
    spec = importlib.util.spec_from_file_location("reader_tts_server", os.path.join(HERE, "server.py"))
    server = importlib.util.module_from_spec(spec)
    server.ENV_FILE = "/nonexistent"
    spec.loader.exec_module(server)
    return server, request


class SynthesizeValidation(unittest.TestCase):
    def setUp(self):
        self.server, self.request = load_server()
        self.server._synthesize = lambda *a: self.fail("must not synthesize")
        self.request.headers = {"Authorization": "Bearer test-key"}

    def status(self, body):
        self.request.body = body
        result = self.server.synthesize()
        return result[1] if isinstance(result, tuple) and isinstance(result[1], int) else 200

    def test_non_string_text_is_400(self):
        for body in ({"text": 123}, {"text": ["a"]}, {"text": {"a": 1}}, {"text": True}):
            self.assertEqual(self.status(body), 400, body)

    def test_body_that_is_not_an_object_is_400(self):
        for body in ([1, 2], "text", 5, None):
            self.assertEqual(self.status(body), 400, body)

    def test_empty_text_is_400_and_too_long_is_413(self):
        self.assertEqual(self.status({"text": "   "}), 400)
        self.assertEqual(self.status({"text": "x" * 3001}), 413)

    def test_wrong_key_is_401(self):
        self.request.headers = {"Authorization": "Bearer nope"}
        self.assertEqual(self.status({"text": "hello"}), 401)


if __name__ == "__main__":
    unittest.main()
