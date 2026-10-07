# Password Vault 2.0

Aplicação desktop para guardar passwords, comandos, URLs, tags e notas num cofre local cifrado.

## Segurança

- Argon2id para derivação da chave a partir da master password.
- AES-256-GCM para cifrar o conteúdo do cofre.
- Master password nunca é guardada.
- Cada gravação usa um IV aleatório.
- O ficheiro `vault.enc` e o backup são criados com permissões restritas quando suportado pelo sistema.
- Backup automático em `vault.enc.bak` antes de substituir o cofre.
- O renderer Electron não tem acesso direto ao filesystem ou ao módulo de criptografia.
- `contextIsolation` e `nodeIntegration: false` estão ativos.

## Instalação

Requer Node.js 20 ou superior.

```bash
npm install
npm start
```

## Testes

```bash
npm test
```

## Local do cofre

Por defeito: `vault.enc` na pasta onde a aplicação é iniciada.

Para definir outro local:

```bash
VAULT_FILE="/caminho/para/vault.enc" npm start
```

## Primeira utilização

No primeiro arranque, a aplicação pede uma master password com pelo menos 12 caracteres e cria o cofre.

Depois de desbloqueado é possível criar, editar, apagar, pesquisar e copiar credenciais e comandos.
