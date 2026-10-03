terraform {
  required_version = ">= 1.11.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.17.0"
    }
  }
}
provider "vercel" {
  team = var.team_id
}
