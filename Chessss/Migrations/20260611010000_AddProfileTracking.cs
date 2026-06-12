using Chessss.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Chessss.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260611010000_AddProfileTracking")]
    public partial class AddProfileTracking : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxAIDifficultyBeaten",
                table: "AspNetUsers",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PlayedAsWhite",
                table: "UserGames",
                type: "INTEGER",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxAIDifficultyBeaten",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PlayedAsWhite",
                table: "UserGames");
        }
    }
}
