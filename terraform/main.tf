# Adopt the deployed project without duplicating or destroying it.
import {
  to = vercel_project.betsport
  id = "${var.team_id}/${var.project_id}"
}
resource "vercel_project" "betsport" {
  name            = "betsport-pro-milton-flores"
  team_id         = var.team_id
  framework       = "nextjs"
  node_version    = "24.x"
  build_command   = "npm run build"
  install_command = "npm ci"
  lifecycle {
    prevent_destroy = true
  }
}
