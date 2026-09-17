# -*- coding: utf-8 -*-
"""
Informacion de cada freeshop (no son productos, son datos de la tienda en si):
direccion, telefono, horario, redes sociales.

Esto se muestra en el sitio cuando el usuario abre el detalle de un producto,
para que sepa donde queda esa tienda y como contactarla.

Las claves de este diccionario (ej: "DFA") tienen que coincidir EXACTO con el
valor del campo "tienda" que devuelve cada scraper, porque el sitio busca la
info de la tienda por ese nombre.

catalogo_online=False marca tiendas de las que NO se pueden sacar productos
(no publican precios en su web), pero que igual queremos mostrar en la lista
de freeshops de la zona con su info de contacto.

Si algun dato no se pudo confirmar (por ejemplo, un horario que no figura en
ningun lado), se deja en None en vez de inventarlo.
"""

STORES = {
    "DFA": {
        "nombre_completo": "DFA Uruguay (Duty Free Americas)",
        "direccion": "Av. Sarandí 475, Rivera, Uruguay",
        "telefono": "+598 4622 1100",
        "email": None,
        "horario": None,
        "sitio_web": "https://www.dfauy.com/",
        "redes": {
            "instagram": "https://www.instagram.com/dfa_uruguay/",
            "facebook": "https://www.facebook.com/dfauruguay/",
        },
        "nota": "Cadena con locales en Rivera, Artigas, Bella Unión, Acegua, Río Branco y Chuy.",
        "catalogo_online": True,
    },
    "Sineriz": {
        "nombre_completo": "Siñeriz Shopping",
        "direccion": "Av. Sarandí 338, Rivera, Uruguay",
        "telefono": "+598 4624 1000",
        "email": None,
        "horario": "Todos los días de 9:00 a 20:00 (verificar en el local)",
        "sitio_web": "https://www.sineriz.com.uy/",
        "redes": {
            "instagram": "https://www.instagram.com/sinerizfreeshop/",
        },
        "nota": None,
        "catalogo_online": True,
    },
    "Barão Free Shop": {
        "nombre_completo": "Barão Free Shop",
        "direccion": "Agraciada esq. Paysandú, Rivera, Uruguay",
        "telefono": "+598 4623 9211",
        "email": None,
        "horario": "Lun a vie 7:00–18:00, sáb 7:00–18:00, dom 8:00–12:00",
        "sitio_web": "https://www.baraofreeshop.com.br/",
        "redes": {
            "instagram": "https://www.instagram.com/baraofreeshop/",
            "facebook": "https://www.facebook.com/baraofshop/",
            "telegram": "https://t.me/baraofreeshop",
        },
        "nota": None,
        "catalogo_online": True,
    },
    "Yury's Free Shop": {
        "nombre_completo": "Yury's Free Shop",
        "direccion": "Agraciada 514, Rivera, Uruguay",
        "telefono": "+598 95 302 277",
        "email": "info@yurysfreeshop.com",
        "horario": None,
        "sitio_web": "https://www.yurysfreeshop.com/",
        "redes": {
            "instagram": "https://www.instagram.com/yurysfreeshop/",
            "facebook": "https://www.facebook.com/yurysfreeshop",
        },
        "nota": None,
        "catalogo_online": True,
    },
    "Neutral": {
        "nombre_completo": "Neutral Free Shop",
        "direccion": "Rivera, Uruguay (ver sucursal exacta en el sitio)",
        "telefono": None,
        "email": None,
        "horario": None,
        "sitio_web": "https://www.neutral.com.uy/es/shops/Rivera",
        "redes": {
            "instagram": "http://instagram.com/NeutralDutyFree",
            "facebook": "https://www.facebook.com/neutraldutyfree",
        },
        "nota": "La cadena más grande de la zona, con locales en Rivera, Río Branco, Chuy, Artigas, Bella Unión y Acegua. El catálogo online es compartido por toda la cadena.",
        "catalogo_online": True,
    },
    "Oprha Free Shop": {
        "nombre_completo": "Oprha Free Shop",
        "direccion": "Av. Sarandí 305, Rivera, Uruguay",
        "telefono": None,
        "email": None,
        "horario": None,
        "sitio_web": "https://www.oprhafreeshop.com/",
        "redes": {
            "instagram": "https://www.instagram.com/oprhafreeshop/",
            "facebook": "https://www.facebook.com/orphafreeshoprivera/",
        },
        "nota": "Especializada únicamente en perfumes y cosméticos.",
        "catalogo_online": True,
    },
    "Zebra Free Shop": {
        "nombre_completo": "Zebra Free Shop",
        "direccion": "Sarandí 455, Rivera, Uruguay",
        "telefono": "+598 4622 4103",
        "email": "info@zebrafreeshop.com.uy",
        "horario": "Lun a vie 8:30–18:30, sáb 8:00–18:30 (cerrado domingos)",
        "sitio_web": "https://zebrafreeshop.com.uy/",
        "redes": {
            "instagram": "https://instagram.com/zebra_freeshop",
            "facebook": "https://facebook.com/zebrafreeshop",
        },
        "nota": "No publica precios online: catálogo solo disponible en el local.",
        "catalogo_online": False,
    },
    "Mantra Free Shop": {
        "nombre_completo": "Mantra Free Shop",
        "direccion": "Av. Sarandí 402, Rivera, Uruguay",
        "telefono": "+55 55 99126-1678",
        "email": "mantradutyfree@gmail.com",
        "horario": "Lun a sáb 7:30–18:00, dom 8:30–12:30",
        "sitio_web": "https://mantrafreeshop.com/",
        "redes": {
            "instagram": "https://instagram.com/mantra_free_shop",
            "facebook": "https://facebook.com/mantradutyfree",
            "whatsapp": "https://wa.me/555591261678",
        },
        "nota": "Catálogo online disponible; los precios y la disponibilidad pueden cambiar sin aviso.",
        "catalogo_online": True,
    },
}
