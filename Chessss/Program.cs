using Chessss;
using Chessss.Components;
using Chessss.Data;
using Chessss.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MudBlazor.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "DataProtectionKeys")))
    .SetApplicationName("UltraChess");

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/auth";
    options.LogoutPath = "/logout";
    options.AccessDeniedPath = "/auth";
});

builder.Services.AddScoped<TrainingService>();
builder.Services.AddScoped<Chessss.Services.UserDifficultyService>();
builder.Services.AddMudServices();
builder.Services.AddRazorPages();
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
builder.Services.AddCascadingAuthenticationState();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();

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
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorPages();

app.MapPost("/auth/login", async (
    HttpContext httpContext,
    IAntiforgery antiforgery,
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager) =>
{
    try
    {
        await antiforgery.ValidateRequestAsync(httpContext);
    }
    catch (AntiforgeryValidationException)
    {
        return Results.Redirect("/auth?error=form");
    }

    var form = await httpContext.Request.ReadFormAsync();
    var email = form["email"].ToString().Trim();
    var password = form["password"].ToString();

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
    {
        return Results.Redirect("/auth?error=missing");
    }

    var user = await userManager.FindByEmailAsync(email);
    if (user is null)
    {
        return Results.Redirect("/auth?error=invalid");
    }

    var result = await signInManager.PasswordSignInAsync(user, password, isPersistent: false, lockoutOnFailure: false);

    if (result.Succeeded)
    {
        return Results.Redirect("/");
    }

    if (result.IsLockedOut)
    {
        return Results.Redirect("/auth?error=locked");
    }

    if (result.IsNotAllowed)
    {
        return Results.Redirect("/auth?error=notallowed");
    }

    return Results.Redirect("/auth?error=invalid");
});

app.MapPost("/logout", async (
    HttpContext httpContext,
    IAntiforgery antiforgery,
    SignInManager<ApplicationUser> signInManager) =>
{
    try
    {
        await antiforgery.ValidateRequestAsync(httpContext);
    }
    catch (AntiforgeryValidationException)
    {
        return Results.Redirect("/auth?error=form");
    }

    await signInManager.SignOutAsync();
    return Results.Redirect("/auth?loggedOut=1");
});

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
