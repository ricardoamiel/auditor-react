"""Modelo de lenguaje local en 4 bits (NF4), con decodificación voraz y conteo de tokens."""
import time
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


class LLM:
    def __init__(self, nombre, cuatro_bits=True):
        self.nombre = nombre
        self.tok = AutoTokenizer.from_pretrained(nombre)
        cuant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                   bnb_4bit_use_double_quant=True,
                                   bnb_4bit_compute_dtype=torch.float16) if cuatro_bits else None
        self.model = AutoModelForCausalLM.from_pretrained(
            nombre, quantization_config=cuant, dtype=torch.float16 if cuatro_bits else torch.bfloat16,
            device_map="auto")
        self.model.eval()
        self.reiniciar_contadores()

    def reiniciar_contadores(self):
        self.llamadas, self.tokens_in, self.tokens_out, self.segundos = 0, 0, 0, 0.0

    @torch.no_grad()
    def chat(self, mensajes, max_new_tokens=512, stop=None):
        """mensajes: lista de dicts con role y content. stop: cadenas donde se corta la generación."""
        t0 = time.time()
        # return_dict fija la salida: transformers 5 devuelve un diccionario y 4.x un tensor si no se pide
        entrada = self.tok.apply_chat_template(mensajes, add_generation_prompt=True, return_tensors="pt",
                                               return_dict=True).to(self.model.device)
        ids = entrada["input_ids"]
        out = self.model.generate(ids, attention_mask=entrada["attention_mask"], max_new_tokens=max_new_tokens, do_sample=False,
                                  stop_strings=stop, tokenizer=self.tok if stop else None,
                                  pad_token_id=self.tok.eos_token_id)
        nuevos = out[0, ids.shape[1]:]
        texto = self.tok.decode(nuevos, skip_special_tokens=True)
        for s in stop or []:  # quita la cadena de parada si quedó al final
            if s in texto:
                texto = texto.split(s)[0]
        self.llamadas += 1
        self.tokens_in += ids.shape[1]
        self.tokens_out += len(nuevos)
        self.segundos += time.time() - t0
        return texto.strip()
