"""Optional notifications. Credentials are GitHub secrets, never catalog files."""
import json
import os
from pathlib import Path
import smtplib
import ssl
from email.message import EmailMessage
from urllib.request import Request, urlopen


def alerts(health, threshold=3, partial_threshold=3):
    rows = []
    for name, state in health.items():
        failures = int(state.get('fallos_consecutivos') or 0)
        partial = int(state.get('parciales_consecutivos') or 0)
        if failures >= threshold or partial >= partial_threshold:
            rows.append(f"{name}: estado {state.get('estado', 'desconocido')}, {failures} fallos / {partial} parciales consecutivos. Último éxito: {state.get('ultimo_exito') or 'sin registro'}.")
    return rows


def main():
    health = json.loads(Path('data/health.json').read_text(encoding='utf-8'))
    rows = alerts(health, max(1, int(os.getenv('HEALTH_FAILURE_THRESHOLD') or '3')),
                  max(1, int(os.getenv('HEALTH_PARTIAL_THRESHOLD') or '3')))
    if os.getenv('SCRAPE_OUTCOME') == 'failure': rows.insert(0, 'La corrida de scraping falló o agotó su tiempo. Revisá el log; health.json puede contener el estado anterior.')
    if not rows:
        print('Sin alertas de salud.'); return
    link = os.getenv('GITHUB_SERVER_URL', 'https://github.com')+'/'+os.getenv('GITHUB_REPOSITORY', '')+'/actions/runs/'+os.getenv('GITHUB_RUN_ID', '')
    message = 'RivFree · Alertas de scrapers\n'+'\n'.join(rows)+'\n'+link
    print(message)
    failed = False
    for variable, key in [('SLACK_WEBHOOK_URL', 'text'), ('DISCORD_WEBHOOK_URL', 'content')]:
        url = os.getenv(variable)
        if not url: continue
        try:
            if not url.startswith('https://'): raise ValueError('HTTPS requerido')
            payload = {key: message[:1900] if key == 'content' else message}
            if key == 'content': payload['allowed_mentions'] = {'parse': []}
            request = Request(url, data=json.dumps(payload).encode(), headers={'Content-Type':'application/json'}, method='POST')
            with urlopen(request, timeout=20) as response: response.read()
            print(variable+': enviado')
        except Exception:
            # Do not log exception URLs or SMTP credentials.
            print(variable+': no se pudo enviar; revisá el secreto y el proveedor.'); failed = True
    if os.getenv('SMTP_HOST') and os.getenv('ALERT_EMAIL_TO'):
        try:
            mail = EmailMessage(); mail['Subject']='RivFree: revisar scrapers'; mail['From']=os.environ['ALERT_EMAIL_FROM']; mail['To']=os.environ['ALERT_EMAIL_TO']; mail.set_content(message)
            with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.getenv('SMTP_PORT') or '587'), timeout=20) as client:
                client.starttls(context=ssl.create_default_context())
                if os.getenv('SMTP_USER'): client.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
                client.send_message(mail)
            print('Email enviado')
        except Exception:
            print('Email: no se pudo enviar; revisá los secretos SMTP.'); failed = True
    if failed: raise SystemExit(1)


if __name__ == '__main__': main()
