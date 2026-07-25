param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 3013
)

$ErrorActionPreference = "Stop"

function Send-TextResponse {
  param(
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [string]$Text
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = "text/plain; charset=utf-8"
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
$rootFull = [System.IO.Path]::GetFullPath($resolvedRoot).TrimEnd('\') + '\'

$listener = [System.Net.HttpListener]::new()
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Serving $rootFull at $prefix"

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    continue
  }

  try {
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "demov3.html"
    }

    $candidate = Join-Path -Path $rootFull -ChildPath $requestPath
    $filePath = [System.IO.Path]::GetFullPath($candidate)

    if (-not $filePath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-TextResponse -Context $context -StatusCode 403 -Text "Forbidden"
      continue
    }

    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      Send-TextResponse -Context $context -StatusCode 404 -Text "Not found"
      continue
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = switch ($extension) {
      ".html" { "text/html; charset=utf-8" }
      ".css" { "text/css; charset=utf-8" }
      ".js" { "application/javascript; charset=utf-8" }
      ".json" { "application/json; charset=utf-8" }
      ".png" { "image/png" }
      ".jpg" { "image/jpeg" }
      ".jpeg" { "image/jpeg" }
      ".svg" { "image/svg+xml" }
      default { "application/octet-stream" }
    }

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $context.Response.StatusCode = 200
    $context.Response.ContentType = $contentType
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  } catch {
    try {
      Send-TextResponse -Context $context -StatusCode 500 -Text "Server error"
    } catch {}
  }
}
