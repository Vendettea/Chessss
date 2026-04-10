using Chessss;
using Chessss.Components;
using Chessss.Data;
using Chessss.Models;
using Microsoft.EntityFrameworkCore;
using MudBlazor.Services;
using Microsoft.AspNetCore.Identity; // Добавь это

var builder = WebApplication.CreateBuilder(args);

// 1. БД
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. IDENTITY (Исправленная конфигурация)
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false; // Чтобы не ругался на простые пароли
    options.Password.RequireLowercase = false;
    options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// 3. СЕРВИСЫ
builder.Services.AddScoped<TrainingService>();
builder.Services.AddScoped<Chessss.Services.UserDifficultyService>();
builder.Services.AddMudServices();
builder.Services.AddRazorPages(); // Нужно для Identity
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

// Важно для работы каскадного состояния авторизации
builder.Services.AddCascadingAuthenticationState();

var app = builder.Build();

// Инициализация тегов (твой код)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated(); // Гарантируем, что БД создана
    if (!db.Tags.Any())
    {
        db.Tags.AddRange(new List<Tag> {
            new Tag { Name = "Дебюты" },
            new Tag { Name = "Миттельшпиль" },
            new Tag { Name = "Эндшпиль" }
        });
        db.SaveChanges();
    }
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles(); // Важно для стилей

app.UseRouting(); // Добавь явно

app.UseAuthentication();
app.UseAuthorization();

app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorPages(); // Для страниц входа

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();