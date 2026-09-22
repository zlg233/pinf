"""Guard the backend deployment against pulling the upstream repository."""

import re
import unittest
from pathlib import Path


WORKFLOW = (
    Path(__file__).resolve().parents[2]
    / ".github"
    / "workflows"
    / "backend-deploy.yml"
)


class BackendDeployWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")

    def test_deploys_only_from_owned_github_repository(self) -> None:
        self.assertIn("github.repository == 'zlg233/pinf'", self.workflow)
        self.assertIn("https://github.com/zlg233/pinf.git", self.workflow)
        self.assertNotIn("git.unself.cn:Handy_Wote/pinf.git", self.workflow)

    def test_uses_github_runner_and_updates_only_backend(self) -> None:
        self.assertIn("runs-on: ubuntu-latest", self.workflow)
        self.assertRegex(
            self.workflow,
            re.compile(r"docker compose up -d --build --no-deps backend"),
        )
        self.assertNotIn("docker compose up -d --build\n", self.workflow)

    def test_deploys_the_commit_that_triggered_the_workflow(self) -> None:
        self.assertIn('git merge --ff-only "${{ github.sha }}"', self.workflow)

    def test_root_deployment_requires_key_and_verified_host(self) -> None:
        self.assertIn("username: root", self.workflow)
        self.assertIn("key: ${{ secrets.DEPLOY_SSH_KEY }}", self.workflow)
        self.assertIn("fingerprint: ${{ vars.DEPLOY_HOST_FINGERPRINT }}", self.workflow)
        self.assertIn('test "$(id -u)" -eq 0', self.workflow)
        self.assertNotIn("DEPLOY_PASSWORD", self.workflow)


if __name__ == "__main__":
    unittest.main()
