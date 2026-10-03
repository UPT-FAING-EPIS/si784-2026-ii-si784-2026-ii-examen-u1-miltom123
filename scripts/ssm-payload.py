import json
import os
import shlex
from pathlib import Path

names = ['ECR_REPOSITORY_URL', 'GITHUB_SHA', 'AWS_REGION', 'APP_ORIGIN', 'JWT_PARAMETER_NAME']
assignments = ['export ' + name + '=' + shlex.quote(os.environ[name]) for name in names]
script = '\n'.join(assignments) + '\n' + Path('scripts/deploy-container.sh').read_text()
print(json.dumps({'commands': ['bash -c ' + shlex.quote(script)], 'executionTimeout': ['600']}))
