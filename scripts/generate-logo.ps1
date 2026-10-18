# Generates the Tressurer logo PNGs — blue coin + white "T" + gold rising bars.
# Re-run any time: powershell scripts\generate-logo.ps1
param([int]$Size = 1024, [string]$Out = "assets\images\icon.png")

Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap $Size, $Size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0x25, 0x63, 0xEB))
$gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0xF5, 0x9E, 0x0B))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

$m = [int]($Size * 0.04)
$g.FillEllipse($blue, $m, $m, $Size - 2 * $m, $Size - 2 * $m)

# "T" — top bar + stem
$tx = [int]($Size * 0.29); $ty = [int]($Size * 0.235)
$g.FillRectangle($white, $tx, $ty, [int]($Size * 0.42), [int]($Size * 0.09))
$g.FillRectangle($white, [int]($Size * 0.455), $ty, [int]($Size * 0.09), [int]($Size * 0.40))

# gold ascending bars (treasury mark) along the bottom of the coin
$bw = [int]($Size * 0.09); $gap = [int]($Size * 0.045); $base = [int]($Size * 0.70)
$x0 = [int]($Size * 0.315)
$heights = @(0.09, 0.16, 0.23)
for ($i = 0; $i -lt 3; $i++) {
  $h = [int]($Size * $heights[$i])
  $g.FillRectangle($gold, $x0 + $i * ($bw + $gap), $base - $h, $bw, $h)
}

$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "Wrote $Out ($Size x $Size)"
