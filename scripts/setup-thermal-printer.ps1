#requires -RunAsAdministrator
<#
.SYNOPSIS
    Registra la impresora termica POS-8360 en red, en esta computadora.

.DESCRIPTION
    Correr una vez por cada maquina que vaya a imprimir desde el ERP.

    El ERP no le habla a la impresora directamente: habla con QZ Tray en
    localhost, y QZ Tray imprime a traves de las colas de Windows. Por eso
    cada computadora necesita su propia cola apuntando a la impresora, aunque
    la impresora sea una sola y este en la red.

    Requisitos previos en esta maquina:
      1. Driver POS-80 instalado (carpeta "80MM Thermal Printer Driver & Tools")
      2. QZ Tray instalado y corriendo  (https://qz.io)

.PARAMETER PrinterIp
    IP de la impresora en la red. Debe coincidir con la que se configuro con
    el "Printer Setup Tools" del fabricante.

.PARAMETER PrinterName
    Nombre con el que aparecera en Windows. Dejarlo igual en todas las
    maquinas: el ERP guarda el nombre elegido en localStorage por navegador,
    y tenerlos parejos evita reconfigurar uno por uno.

.EXAMPLE
    .\setup-thermal-printer.ps1 -PrinterIp 192.168.100.200
#>
param(
    [Parameter(Mandatory = $true)]
    [string] $PrinterIp,

    [string] $PrinterName = 'POS-80',

    # 9100 es el puerto RAW estandar. La impresora recibe bytes ESC/POS tal
    # cual por ahi, que es justo lo que el ERP envia.
    [int] $Port = 9100
)

$ErrorActionPreference = 'Stop'

Write-Host "Verificando que $PrinterIp responda en el puerto $Port..." -ForegroundColor Cyan
$probe = New-Object System.Net.Sockets.TcpClient
$async = $probe.BeginConnect($PrinterIp, $Port, $null, $null)
$ok = $async.AsyncWaitHandle.WaitOne(3000) -and $probe.Connected
$probe.Close()

if (-not $ok) {
    Write-Host "ERROR: no hay respuesta en ${PrinterIp}:${Port}." -ForegroundColor Red
    Write-Host "Revisa que la impresora este encendida, con el cable de red conectado," -ForegroundColor Yellow
    Write-Host "y que su IP este en la misma subred que esta computadora." -ForegroundColor Yellow
    Write-Host "La IP de fabrica es 192.168.1.100 y casi nunca sirve tal cual." -ForegroundColor Yellow
    exit 1
}
Write-Host "  Responde." -ForegroundColor Green

# El driver tiene que existir antes de crear la cola.
$driver = Get-PrinterDriver | Where-Object { $_.Name -like 'POS-80*' } | Select-Object -First 1
if (-not $driver) {
    Write-Host "ERROR: no encuentro el driver 'POS-80' en esta maquina." -ForegroundColor Red
    Write-Host "Instalalo primero desde 80MM Thermal Printer Driver & Tools\Printer Driver\Windows Driver." -ForegroundColor Yellow
    exit 1
}
Write-Host "Driver encontrado: $($driver.Name)" -ForegroundColor Green

$portName = "IP_$PrinterIp"
if (-not (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue)) {
    Write-Host "Creando puerto $portName..." -ForegroundColor Cyan
    Add-PrinterPort -Name $portName -PrinterHostAddress $PrinterIp -PortNumber $Port
} else {
    Write-Host "El puerto $portName ya existia." -ForegroundColor DarkGray
}

$existing = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Reapuntando '$PrinterName' al puerto $portName..." -ForegroundColor Cyan
    Set-Printer -Name $PrinterName -PortName $portName
} else {
    Write-Host "Creando impresora '$PrinterName'..." -ForegroundColor Cyan
    Add-Printer -Name $PrinterName -DriverName $driver.Name -PortName $portName
}

# RAW hace que el spooler entregue los bytes sin reinterpretarlos. Si el
# procesador los tocara, romperia el raster ESC/POS que manda el ERP.
Set-Printer -Name $PrinterName -PrintProcessor 'winprint'

Write-Host ""
Write-Host "Listo. '$PrinterName' apunta a ${PrinterIp}:${Port}." -ForegroundColor Green
Get-Printer -Name $PrinterName | Select-Object Name, DriverName, PortName, PrinterStatus | Format-List

Write-Host "Falta, si no se hizo antes en esta maquina:" -ForegroundColor Yellow
Write-Host "  - Instalar QZ Tray (https://qz.io) y dejarlo corriendo." -ForegroundColor Yellow
Write-Host "  - En el ERP, abrir el modal de etiqueta y pulsar 'Detectar'." -ForegroundColor Yellow
