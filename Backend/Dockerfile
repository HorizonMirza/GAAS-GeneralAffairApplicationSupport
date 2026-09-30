# ==========================================
# 1. Build Stage
# ==========================================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY PengirimanApi.csproj ./
RUN dotnet restore PengirimanApi.csproj

# Copy source code and publish
COPY . ./
RUN dotnet publish PengirimanApi.csproj -c Release -o /app/publish /p:UseAppHost=false

# ==========================================
# 2. Runtime Stage
# ==========================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install native libraries required for QuestPDF (libfontconfig) and Skia/ImageSharp font rendering
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libfontconfig1 \
        fonts-dejavu-core \
        libicu-dev \
    && rm -rf /var/lib/apt/lists/*

# Environment variables
ENV ASPNETCORE_URLS=http://+:8000 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    UploadDir=/app/uploads/invoices \
    AtkInvoiceUploadDir=/app/uploads/atk-invoices \
    SaranaUploadDir=/app/uploads/sarana \
    ProfilePhotoUploadDir=/app/uploads/profile-photos \
    AppLogoUploadDir=/app/uploads/app-logo

# Create upload directories
RUN mkdir -p /app/uploads/invoices \
             /app/uploads/atk-invoices \
             /app/uploads/sarana \
             /app/uploads/profile-photos \
             /app/uploads/app-logo

COPY --from=build /app/publish .

EXPOSE 8000
ENTRYPOINT ["dotnet", "PengirimanApi.dll"]
